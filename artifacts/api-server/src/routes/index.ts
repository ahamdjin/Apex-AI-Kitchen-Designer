import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apexRouter from "./apex";

const router: IRouter = Router();

router.use(healthRouter);
router.use(apexRouter);

export default router;
