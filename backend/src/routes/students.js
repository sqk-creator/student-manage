const { Router } = require('express');
const studentController = require('../controllers/studentController');

const router = Router();
router.get('/', studentController.listAll);
router.get('/:id', studentController.get);
router.put('/:id', studentController.update);
router.delete('/:id', studentController.remove);
router.put('/:id/transfer', studentController.transfer);

module.exports = router;
