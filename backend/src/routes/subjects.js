const router = require('express').Router();
const ctrl = require('../controllers/subjectController');

router.get('/', ctrl.list);
router.get('/list', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
