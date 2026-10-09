import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import stateRouter from "./state";
import systemRouter from "./system";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(stateRouter);
router.use(systemRouter);

export default router;
