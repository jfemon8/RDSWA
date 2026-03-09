import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { BusOperator, BusRoute, BusSchedule, BusCounter } from '../models';
import { UserRole } from '@rdswa/shared';

const router = Router();

// --- Operators ---
router.get('/operators', asyncHandler(async (_req, res) => {
  const operators = await BusOperator.find({ isDeleted: false }).sort({ name: 1 });
  ApiResponse.success(res, operators);
}));

router.post('/operators', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.operator_create', 'bus_operators'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const op = await BusOperator.create({ ...req.body, createdBy: req.user._id });
  ApiResponse.created(res, op, 'Operator created');
}));

router.patch('/operators/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.operator_update', 'bus_operators'), asyncHandler(async (req, res) => {
  const op = await BusOperator.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true });
  if (!op) throw ApiError.notFound('Operator not found');
  ApiResponse.success(res, op, 'Operator updated');
}));

router.delete('/operators/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.operator_delete', 'bus_operators'), asyncHandler(async (req, res) => {
  await BusOperator.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
  ApiResponse.success(res, null, 'Operator deleted');
}));

// --- Routes ---
router.get('/routes', asyncHandler(async (req, res) => {
  const filter: any = { isDeleted: false };
  if (req.query.routeType) filter.routeType = req.query.routeType;
  if (req.query.origin) filter.origin = { $regex: req.query.origin, $options: 'i' };
  if (req.query.destination) filter.destination = { $regex: req.query.destination, $options: 'i' };
  const routes = await BusRoute.find(filter).populate('operator', 'name logo').sort({ origin: 1 });
  ApiResponse.success(res, routes);
}));

router.post('/routes', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.route_create', 'bus_routes'), asyncHandler(async (req, res) => {
  const route = await BusRoute.create(req.body);
  ApiResponse.created(res, route, 'Route created');
}));

router.patch('/routes/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.route_update', 'bus_routes'), asyncHandler(async (req, res) => {
  const route = await BusRoute.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true });
  if (!route) throw ApiError.notFound('Route not found');
  ApiResponse.success(res, route, 'Route updated');
}));

router.delete('/routes/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.route_delete', 'bus_routes'), asyncHandler(async (req, res) => {
  await BusRoute.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
  ApiResponse.success(res, null, 'Route deleted');
}));

// --- Schedules ---
router.get('/schedules', asyncHandler(async (req, res) => {
  const filter: any = { isDeleted: false, isActive: true };
  if (req.query.route) filter.route = req.query.route;
  if (req.query.busCategory) filter.busCategory = req.query.busCategory;
  const schedules = await BusSchedule.find(filter)
    .populate({ path: 'route', populate: { path: 'operator', select: 'name logo' } })
    .sort({ departureTime: 1 });
  ApiResponse.success(res, schedules);
}));

router.post('/schedules', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.schedule_create', 'bus_schedules'), asyncHandler(async (req, res) => {
  const schedule = await BusSchedule.create(req.body);
  ApiResponse.created(res, schedule, 'Schedule created');
}));

router.patch('/schedules/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.schedule_update', 'bus_schedules'), asyncHandler(async (req, res) => {
  const schedule = await BusSchedule.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true });
  if (!schedule) throw ApiError.notFound('Schedule not found');
  ApiResponse.success(res, schedule, 'Schedule updated');
}));

router.delete('/schedules/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.schedule_delete', 'bus_schedules'), asyncHandler(async (req, res) => {
  await BusSchedule.findOneAndUpdate({ _id: req.params.id }, { isDeleted: true });
  ApiResponse.success(res, null, 'Schedule deleted');
}));

// --- Counters ---
router.get('/counters', asyncHandler(async (_req, res) => {
  const counters = await BusCounter.find({ isDeleted: false }).populate('operator', 'name').sort({ name: 1 });
  ApiResponse.success(res, counters);
}));

router.post('/counters', authenticate(), authorize(UserRole.ADMIN), auditLog('bus.counter_create', 'bus_counters'), asyncHandler(async (req, res) => {
  const counter = await BusCounter.create(req.body);
  ApiResponse.created(res, counter, 'Counter created');
}));

router.patch('/counters/:id', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const counter = await BusCounter.findOneAndUpdate({ _id: req.params.id, isDeleted: false }, { $set: req.body }, { new: true });
  if (!counter) throw ApiError.notFound('Counter not found');
  ApiResponse.success(res, counter, 'Counter updated');
}));

export default router;
