const { Router } = require('express');
const classController = require('../controllers/classController');
const studentController = require('../controllers/studentController');
const examController = require('../controllers/examController');

const router = Router();

router.get('/', classController.list);
router.post('/', classController.create);
router.get('/:id', classController.get);
router.put('/:id', classController.update);
router.delete('/:id', classController.remove);

router.get('/:classId/students', studentController.list);
router.post('/:classId/students', studentController.create);
router.post('/:classId/teachers', classController.addTeacher);
router.put('/:classId/teachers/:teacherId', classController.updateTeacher);
router.delete('/:classId/teachers/:teacherId', classController.removeTeacher);

router.get('/:classId/exams', examController.list);
router.post('/:classId/exams', examController.create);

module.exports = router;
