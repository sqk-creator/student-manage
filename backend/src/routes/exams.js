const { Router } = require('express');
const examController = require('../controllers/examController');
const router = Router();

router.get('/', examController.list);
router.get('/:id', examController.getById);
router.post('/', examController.create);
router.put('/:id', examController.update);
router.delete('/:id', examController.remove);

router.get('/:examId/scores', examController.getScores);
router.post('/:examId/scores', examController.enterScores);
router.get('/:examId/stats', examController.getStats);

module.exports = router;
