import { Notice, INoticeDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';

interface ListNoticesQuery {
  page?: string;
  limit?: string;
  category?: string;
  status?: string;
  search?: string;
  archived?: string;
}

export class NoticeService {
  async list(query: ListNoticesQuery, isAdmin = false) {
    const { page, limit } = parsePagination(query);
    const filter: FilterQuery<INoticeDocument> = { isDeleted: false };

    if (!isAdmin) {
      // Public users: show published or archived (when toggled)
      if (query.archived === 'true') {
        filter.status = 'archived';
      } else {
        filter.status = 'published';
        filter.$or = [
          { scheduledPublishAt: { $exists: false } },
          { scheduledPublishAt: { $lte: new Date() } },
        ];
      }
    } else if (query.status) {
      filter.status = query.status;
    }

    if (query.category) filter.category = query.category;

    // Search filter — build $or separately and merge with $and if needed
    if (query.search) {
      const searchCondition = [
        { title: { $regex: query.search, $options: 'i' } },
        { content: { $regex: query.search, $options: 'i' } },
      ];
      if (filter.$or) {
        // Combine existing $or (scheduled publish) with search $or using $and
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [
          { $or: existingOr },
          { $or: searchCondition },
        ];
      } else {
        filter.$or = searchCondition;
      }
    }

    const [notices, total] = await Promise.all([
      Notice.find(filter)
        .populate('createdBy', 'name avatar')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit),
      Notice.countDocuments(filter),
    ]);

    return { notices, total, page, limit };
  }

  async getById(id: string): Promise<INoticeDocument> {
    const notice = await Notice.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name avatar');
    if (!notice) throw ApiError.notFound('Notice not found');
    return notice;
  }

  async create(data: any, createdBy: string): Promise<INoticeDocument> {
    const notice = await Notice.create({
      ...data,
      createdBy,
      publishedAt: data.status === 'published' ? new Date() : undefined,
    });
    return notice;
  }

  async update(id: string, data: any, userId: string, isAdmin: boolean): Promise<INoticeDocument> {
    const notice = await Notice.findOne({ _id: id, isDeleted: false });
    if (!notice) throw ApiError.notFound('Notice not found');

    if (!isAdmin && notice.createdBy.toString() !== userId) {
      throw ApiError.forbidden('You can only edit your own notices');
    }

    Object.assign(notice, data);
    if (data.status === 'published' && !notice.publishedAt) {
      notice.publishedAt = new Date();
    }
    if (data.status === 'archived') {
      notice.archivedAt = new Date();
    }
    await notice.save();
    return notice;
  }

  async delete(id: string): Promise<void> {
    const notice = await Notice.findOne({ _id: id, isDeleted: false });
    if (!notice) throw ApiError.notFound('Notice not found');
    notice.isDeleted = true;
    await notice.save();
  }

  async archive(id: string): Promise<INoticeDocument> {
    const notice = await Notice.findOne({ _id: id, isDeleted: false });
    if (!notice) throw ApiError.notFound('Notice not found');
    notice.status = 'archived';
    notice.archivedAt = new Date();
    await notice.save();
    return notice;
  }
}

export const noticeService = new NoticeService();
