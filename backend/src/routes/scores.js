const { Router } = require('express');
const scoreController = require('../controllers/scoreController');
const router = Router();

router.get('/', scoreController.list);
router.post('/', scoreController.create);
router.post('/batch', scoreController.batchSave);
router.put('/:id', scoreController.update);
router.delete('/:id', scoreController.remove);

module.exports = router;
