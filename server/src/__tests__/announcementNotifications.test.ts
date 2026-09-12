import {
  announcementNotificationFilter,
  announcementPreview,
  splitAnnouncement,
} from '../utils/announcementNotifications';

const ID = '6512c0a1b2c3d4e5f6a7b8c9';

describe('splitAnnouncement', () => {
  it('separates the title header from the body', () => {
    expect(splitAnnouncement('**Boat Trip**\n\n<p>Join us</p>')).toEqual({
      title: 'Boat Trip',
      body: '<p>Join us</p>',
    });
  });

  it('keeps a multi-line body whole', () => {
    expect(splitAnnouncement('**Notice**\n\nline one\nline two').body).toBe('line one\nline two');
  });

  it('reports no title when the header is missing', () => {
    expect(splitAnnouncement('just a chat message')).toEqual({
      title: null,
      body: 'just a chat message',
    });
  });
});

describe('announcementPreview', () => {
  it('takes the markup out and collapses the whitespace', () => {
    expect(announcementPreview('<p>Join   us</p>\n<p>today</p>')).toBe('Join us today');
  });

  it('caps the preview at 200 characters', () => {
    expect(announcementPreview(`<p>${'x'.repeat(300)}</p>`)).toHaveLength(200);
  });
});

describe('announcementNotificationFilter', () => {
  const filter = announcementNotificationFilter(ID, '**Boat Trip**\n\n<p>Join us</p>');

  it('only ever matches announcement notifications', () => {
    expect(filter.type).toBe('announcement');
  });

  it('matches the id a current notification carries', () => {
    expect(filter.$or).toContainEqual({ 'metadata.announcementId': ID });
  });

  it('matches the id a comment notification carries in its link', () => {
    const clause: any = filter.$or.find((c: any) => c.link);
    expect(new RegExp(clause.link.$regex).test(`/dashboard/announcements/${ID}`)).toBe(true);
    expect(new RegExp(clause.link.$regex).test('/dashboard/announcements/other')).toBe(false);
  });

  it('matches an older notification on both of its texts, so a broadcast is not caught', () => {
    expect(filter.$or).toContainEqual({
      title: 'Boat Trip',
      message: 'Join us',
      'metadata.announcementId': { $exists: false },
    });
  });

  it('drops the text clause when there is no title to match on', () => {
    expect(announcementNotificationFilter(ID, 'no header here').$or).toHaveLength(2);
  });
});
