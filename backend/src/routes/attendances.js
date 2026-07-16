const { Router } = require('express');
const controller = require('../controllers/attendanceController');

const router = Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.get);
router.delete('/:id', controller.remove);

module.exports = router;
