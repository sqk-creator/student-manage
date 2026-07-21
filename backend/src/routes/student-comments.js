const router = require('express').Router({ mergeParams: true });
const ctrl = require('../controllers/studentCommentController');

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
