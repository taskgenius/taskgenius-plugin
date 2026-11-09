import { calculateDailyHabitPoints, pointListItems, pointDate } from "../daily-points";

test("YAML date keys returned as Date strings keep their original local day", () => {
	expect(pointDate(new Date(2026, 2, 8).toString())).toBe("2026-03-08");
});

const habit = (frontmatter: Record<string, any>, name = "Writing") => ({ name, path: `Habits/${name}.md`, frontmatter });

test("habit rates override panel rules, including zero, and records are recalculated without ledger copies", () => {
	const data = { defaultPointRule: { baseRate: 0.1 }, pointRules: [{ habit: "Writing", baseRate: 4 }] };
	const source = habit({ type: "repetition", bravoPoints: 2, records: { "2026-11-01": 3, "2026-11-02": 1 } });
	expect(calculateDailyHabitPoints([source], data, "2026-11-02")[0]).toMatchObject({ rate: 2, points: 8, todayPoints: 2 });
	expect(calculateDailyHabitPoints([habit({ ...source.frontmatter, bravoPoints: 0 })], data)[0].points).toBe(0);
	delete source.frontmatter.records["2026-11-01"];
	expect(calculateDailyHabitPoints([source], data)[0].points).toBe(2);
});

test("negative rates deduct only excess consumption in the daily or weekly allowance", () => {
	const records = { "2026-11-02": 1, "2026-11-03": 2, "2026-11-09": 1 };
	const weekly = habit({ type: "repetition", bravoPoints: -10, target: 2, frequency: "flexibleWeekly", records });
	expect(calculateDailyHabitPoints([weekly], {}, "2026-11-03")[0]).toMatchObject({ points: -10, todayPoints: -10 });
	expect(calculateDailyHabitPoints([habit({ ...weekly.frontmatter, frequency: "daily" })], {})[0].points).toBe(0);
});

test("binary check-ins, fractional counters, and disabled defaults retain their original meanings", () => {
	expect(calculateDailyHabitPoints([habit({ type: "binary", bravoPoints: 0.5, records: { "2026-11-01": 1, "2026-11-02": 1 } })], {})[0].points).toBe(1);
	expect(calculateDailyHabitPoints([habit({ type: "repetition", records: { "2026-11-01": 2.5 } })], {})[0].points).toBe(0.25);
	expect(calculateDailyHabitPoints([habit({ type: "binary", records: {} })], { defaultPointRule: { enabled: false } })).toEqual([]);
});

test("bonus and reward descriptions remain intact, including debts and items without a price", () => {
	const values = ["Read a book + 50", "Create a video", "Furniture - 2000", "Rent - 700 * 6 - 4200"];
	expect(pointListItems(values).map(item => item.text)).toEqual(values);
	expect(pointListItems(values).map(item => item.amount)).toEqual([50, null, -2000, -4200]);
});


test("daily point deltas keep a weekly allowance when filtering a recent date range", () => {
 const [summary] = calculateDailyHabitPoints([habit({ type: "repetition", frequency: "weekly", target: 3, bravoPoints: -10, records: { "2026-11-02": 3, "2026-11-03": 2, "2026-11-09": 1 } })], {});
 expect(summary.points).toBe(-20);expect(summary.dailyPoints).toEqual({ "2026-11-02": 0, "2026-11-03": -20, "2026-11-09": 0 });
});
