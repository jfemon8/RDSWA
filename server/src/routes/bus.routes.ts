import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { BusOperator, BusRoute, BusSchedule, BusCounter } from '../models';
import { UserRole } from '@rdswa/shared';
import { parsePagination, getSkip } from '../utils/pagination';
import { cacheResponse } from '../middlewares/cache.middleware';
import { getIO } from '../socket';
import {
  createOperatorSchema, updateOperatorSchema,
  createRouteSchema, updateRouteSchema,
  createScheduleSchema, updateScheduleSchema,
  createCounterSchema, updateCounterSchema,
} from '../validators/bus.validator';

const router = Router();

/** Broadcast bus schedule change to all connected clients */
function broadcastBusUpdate(action: string, data?: any): void {
  const io = getIO();
  if (io) {
    io.emit('bus:updated', { action, data });
  }
}

// ── Operators ──

router.get('/operators', cacheResponse(300), asyncHandler(async (req, res) => {
  const filter: any = { isDeleted: false };
  if (req.query.scheduleType) filter.scheduleType = req.query.scheduleType;
  const operators = await BusOperator.find(filter).sort({ name: 1 });
  ApiResponse.success(res, operators);
}));

router.post('/operators', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: createOperatorSchema }),
  auditLog('bus.operator_create', 'bus_operators'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const op = await BusOperator.create({ ...req.body, createdBy: req.user._id });
    ApiResponse.created(res, op, 'Operator created');
  }),
);

router.patch('/operators/:id', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: updateOperatorSchema }),
  auditLog('bus.operator_update', 'bus_operators'),
  asyncHandler(async (req, res) => {
    const op = await BusOperator.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true },
    );
    if (!op) throw ApiError.notFound('Operator not found');
    ApiResponse.success(res, op, 'Operator updated');
  }),
);

router.delete('/operators/:id', authenticate(), authorize(UserRole.ADMIN),
  auditLog('bus.operator_delete', 'bus_operators'),
  asyncHandler(async (req, res) => {
    await BusOperator.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
    ApiResponse.success(res, null, 'Operator deleted');
  }),
);

// ── Routes ──

router.get('/routes', cacheResponse(300), asyncHandler(async (req, res) => {
  const filter: any = { isDeleted: false };
  if (req.query.routeType) filter.routeType = req.query.routeType;
  if (req.query.operator) filter.operator = req.query.operator;
  if (req.query.origin) filter.origin = { $regex: req.query.origin, $options: 'i' };
  if (req.query.destination) filter.destination = { $regex: req.query.destination, $options: 'i' };
  const routes = await BusRoute.find(filter).populate('operator', 'name logo').sort({ origin: 1 });
  ApiResponse.success(res, routes);
}));

router.post('/routes', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: createRouteSchema }),
  auditLog('bus.route_create', 'bus_routes'),
  asyncHandler(async (req, res) => {
    const route = await BusRoute.create(req.body);
    ApiResponse.created(res, route, 'Route created');
  }),
);

router.patch('/routes/:id', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: updateRouteSchema }),
  auditLog('bus.route_update', 'bus_routes'),
  asyncHandler(async (req, res) => {
    const route = await BusRoute.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true },
    );
    if (!route) throw ApiError.notFound('Route not found');
    ApiResponse.success(res, route, 'Route updated');
  }),
);

router.delete('/routes/:id', authenticate(), authorize(UserRole.ADMIN),
  auditLog('bus.route_delete', 'bus_routes'),
  asyncHandler(async (req, res) => {
    await BusRoute.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
    ApiResponse.success(res, null, 'Route deleted');
  }),
);

// ── Schedules (with pagination & routeType filter) ──

router.get('/schedules', cacheResponse(300), asyncHandler(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  const filter: any = { isDeleted: false, isActive: true };
  if (req.query.route) filter.route = req.query.route;
  if (req.query.busCategory) filter.busCategory = req.query.busCategory;
  if (req.query.routeType) {
    const matchingRoutes = await BusRoute.find({ routeType: req.query.routeType, isDeleted: false }).select('_id');
    filter.route = { ...(filter.route || {}), $in: matchingRoutes.map((r) => r._id) };
  }

  // Time-based search: departureAfter / departureBefore (HH:MM 24h format)
  if (req.query.departureAfter || req.query.departureBefore) {
    const timeFilters: any = {};
    if (req.query.departureAfter) timeFilters.$gte = req.query.departureAfter as string;
    if (req.query.departureBefore) timeFilters.$lte = req.query.departureBefore as string;
    filter.departureTime = timeFilters;
  }

  const [schedules, total] = await Promise.all([
    BusSchedule.find(filter)
      .populate({ path: 'route', populate: { path: 'operator', select: 'name logo' } })
      .sort({ departureTime: 1 })
      .skip(getSkip({ page, limit }))
      .limit(limit),
    BusSchedule.countDocuments(filter),
  ]);
  ApiResponse.paginated(res, schedules, total, page, limit);
}));

router.post('/schedules', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: createScheduleSchema }),
  auditLog('bus.schedule_create', 'bus_schedules'),
  asyncHandler(async (req, res) => {
    const schedule = await BusSchedule.create(req.body);
    broadcastBusUpdate('created', schedule);
    ApiResponse.created(res, schedule, 'Schedule created');
  }),
);

router.patch('/schedules/:id', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: updateScheduleSchema }),
  auditLog('bus.schedule_update', 'bus_schedules'),
  asyncHandler(async (req, res) => {
    const schedule = await BusSchedule.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true },
    );
    if (!schedule) throw ApiError.notFound('Schedule not found');
    broadcastBusUpdate('updated', schedule);
    ApiResponse.success(res, schedule, 'Schedule updated');
  }),
);

router.delete('/schedules/:id', authenticate(), authorize(UserRole.ADMIN),
  auditLog('bus.schedule_delete', 'bus_schedules'),
  asyncHandler(async (req, res) => {
    await BusSchedule.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
    broadcastBusUpdate('deleted', { _id: req.params.id });
    ApiResponse.success(res, null, 'Schedule deleted');
  }),
);

// ── Counters ──

router.get('/counters', cacheResponse(300), asyncHandler(async (req, res) => {
  const filter: any = { isDeleted: false };
  if (req.query.operator) filter.operator = req.query.operator;
  const counters = await BusCounter.find(filter).populate('operator', 'name').sort({ name: 1 });
  ApiResponse.success(res, counters);
}));

router.post('/counters', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: createCounterSchema }),
  auditLog('bus.counter_create', 'bus_counters'),
  asyncHandler(async (req, res) => {
    const counter = await BusCounter.create(req.body);
    ApiResponse.created(res, counter, 'Counter created');
  }),
);

router.patch('/counters/:id', authenticate(), authorize(UserRole.ADMIN),
  validate({ body: updateCounterSchema }),
  auditLog('bus.counter_update', 'bus_counters'),
  asyncHandler(async (req, res) => {
    const counter = await BusCounter.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true },
    );
    if (!counter) throw ApiError.notFound('Counter not found');
    ApiResponse.success(res, counter, 'Counter updated');
  }),
);

router.delete('/counters/:id', authenticate(), authorize(UserRole.ADMIN),
  auditLog('bus.counter_delete', 'bus_counters'),
  asyncHandler(async (req, res) => {
    await BusCounter.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
    ApiResponse.success(res, null, 'Counter deleted');
  }),
);

// ── CSV/JSON Bulk Import ──

router.post('/import', authenticate(), authorize(UserRole.ADMIN),
  auditLog('bus.csv_import', 'bus_schedules'),
  asyncHandler(async (req, res) => {
    const { type, data: rows } = req.body;
    if (!type || !Array.isArray(rows) || rows.length === 0) {
      throw ApiError.badRequest('type and data[] are required');
    }
    if (!['operators', 'routes', 'schedules', 'counters'].includes(type)) {
      throw ApiError.badRequest('type must be operators, routes, schedules, or counters');
    }

    let created = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        switch (type) {
          case 'operators':
            await BusOperator.create({
              name: row.name,
              contactNumber: row.contactNumber,
              email: row.email,
              scheduleType: row.scheduleType || 'intercity',
              createdBy: req.user!._id,
            });
            break;
          case 'routes':
            await BusRoute.create({
              operator: row.operator,
              origin: row.origin,
              destination: row.destination,
              routeType: row.routeType || 'intercity',
              distanceKm: row.distanceKm ? Number(row.distanceKm) : undefined,
              estimatedDuration: row.estimatedDuration,
              stops: row.stops || [],
            });
            break;
          case 'schedules':
            await BusSchedule.create({
              route: row.route,
              busName: row.busName,
              busNumber: row.busNumber,
              busCategory: row.busCategory || 'non_ac',
              departureTime: row.departureTime,
              arrivalTime: row.arrivalTime,
              daysOfOperation: row.daysOfOperation || [],
            });
            break;
          case 'counters':
            await BusCounter.create({
              operator: row.operator,
              name: row.name,
              location: row.location,
              phoneNumbers: row.phoneNumbers || [],
            });
            break;
        }
        created++;
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message || 'Validation error' });
      }
    }

    ApiResponse.success(res, { created, errors, total: rows.length }, `Imported ${created}/${rows.length} records`);
  }),
);

// ─── Export bus data ───
router.get('/export/:type', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const exportType = req.params.type as string;
  const format = (req.query.format as string) || 'json';

  let data: any[];
  let filename: string;

  switch (exportType) {
    case 'operators':
      data = await BusOperator.find({ isDeleted: false }).lean();
      filename = 'bus-operators';
      break;
    case 'routes':
      data = await BusRoute.find({ isDeleted: false }).populate('operator', 'name').lean();
      filename = 'bus-routes';
      break;
    case 'schedules':
      data = await BusSchedule.find({ isDeleted: false }).populate('route').lean();
      filename = 'bus-schedules';
      break;
    case 'counters':
      data = await BusCounter.find({ isDeleted: false }).populate('operator', 'name').lean();
      filename = 'bus-counters';
      break;
    default:
      throw ApiError.badRequest('Invalid export type. Use operators, routes, schedules, or counters.');
  }

  if (format === 'csv') {
    if (data.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.send('');
      return;
    }
    const headers = Object.keys(data[0]).filter((k) => k !== '__v');
    const csvRows = [
      headers.join(','),
      ...data.map((row) => headers.map((h) => {
        const val = row[h];
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
    res.send(csvRows.join('\n'));
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
    res.send(JSON.stringify(data, null, 2));
  }
}));

export default router;
