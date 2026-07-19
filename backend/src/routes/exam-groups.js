const { Router } = require('express');
const examGroupController = require('../controllers/examGroupController');
const router = Router();

router.get('/', examGroupController.list);
router.get('/:id', examGroupController.getById);
router.post('/', examGroupController.create);
router.put('/:id', examGroupController.update);
router.delete('/:id', examGroupController.remove);
router.get('/:id/stats', examGroupController.getStats);

module.exports = router;
