import { Router, type IRouter } from "express";
import healthRouter from "./health";
import datasetsRouter from "./datasets";
import jobsRouter from "./jobs";
import annotationsRouter from "./annotations";
import exportsRouter from "./exports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(datasetsRouter);
router.use(jobsRouter);
router.use(annotationsRouter);
router.use(exportsRouter);

export default router;
