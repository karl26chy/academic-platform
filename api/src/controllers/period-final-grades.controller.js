import * as service from '../services/period-final-grades.service.js';

export async function getForClass(req, res, next) {
  try {
    res.json(await service.getForClass(req.user, req.params.assignmentId));
  } catch (err) {
    next(err);
  }
}

export async function saveForClass(req, res, next) {
  try {
    res.json(await service.saveForClass(req.user, req.params.assignmentId, req.body));
  } catch (err) {
    next(err);
  }
}
