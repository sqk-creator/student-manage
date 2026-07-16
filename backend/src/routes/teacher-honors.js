const { Router } = require('express');
const controller = require('../controllers/teacherHonorsController');

const router = Router({ mergeParams: true });

router.get('/', controller.listByTeacher);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/', controller.clearAll);
router.delete('/:id', controller.remove);

module.exports = router;
