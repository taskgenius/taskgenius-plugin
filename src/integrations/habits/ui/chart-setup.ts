import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	Filler,
	LineController,
	LineElement,
	LinearScale,
	PointElement,
	Tooltip,
} from "chart.js";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";

/**
 * Registers every Chart.js component the plugin's charts and heatmaps use.
 * Side-effect only: every file that draws a chart imports this once so
 * registration happens regardless of which chart-drawing module loads first.
 */
Chart.register(
	BarController,
	BarElement,
	CategoryScale,
	Filler,
	LineController,
	LineElement,
	LinearScale,
	MatrixController,
	MatrixElement,
	PointElement,
	Tooltip,
);
