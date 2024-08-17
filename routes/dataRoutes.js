const router = require('express').Router();
const dataController = require("../controller/dataController");
const { authGuard } = require('../middleware/authGurad');

router.post('/create_data', authGuard, dataController.createData);

router.get("/get_data", authGuard, dataController.getData);

router.get("/get_data/:id", authGuard, dataController.getSingleData);


router.put("/update_data/:id", authGuard, dataController.updatedata);

router.delete("/delete_data/:id", authGuard, dataController.deletedata);


module.exports = router;
 