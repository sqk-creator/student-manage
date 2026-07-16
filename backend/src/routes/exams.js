const { Router } = require('express');
const examController = require('../controllers/examController');

const router = Router();
router.get('/:examId/scores', examController.getScores);
router.post('/:examId/scores', examController.enterScores);
router.get('/:examId/stats', examController.getStats);

module.exports = router;
