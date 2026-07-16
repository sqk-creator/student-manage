const { Router } = require('express');
const controller = require('../controllers/teacherProfileController');

const router = Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
