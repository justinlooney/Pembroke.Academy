/** Original complete College Algebra course; the three opening IDs preserve saved progress. */
import { prerequisites } from './algebra/prerequisites.mjs';
import { equations } from './algebra/equations.mjs';
import { functions } from './algebra/functions.mjs';
import { polynomials } from './algebra/polynomials.mjs';
import { exponentials } from './algebra/exponentials.mjs';
import { systems } from './algebra/systems.mjs';
import { matrices } from './algebra/matrices.mjs';
import { conics } from './algebra/conics.mjs';
import { sequences } from './algebra/sequences.mjs';
import { probability } from './algebra/probability.mjs';
import { geometry } from './algebra/geometry.mjs';
import { finalReview } from './algebra/final-review.mjs';
const numeric = (q, ans, work) => ({ q, type: "num", ans, tol: 0, hint: "Write one operation per line, then check by substitution.", work });
const lab = { kind: "line", note: "Move the slider to change m in y = mx + 1. Every line passes through (0, 1). Compare positive, zero and negative slopes." };
export const INTRO_MATH = {
  lectures: "Complete College Algebra: prerequisites, nine chapters, geometry review, and a cumulative practice exam. Every chapter includes teaching, worked examples, explained exercises, and a review test.",
  grading: [["Knowledge checks", "quizzes", 60], ["Homework", "homework", 30], ["Interactive labs", "labs", 10]],
  units: [{ title: "Start here · Three core skills", sections: [
    { n: "1.1", t: "Expressions and substitution",
      brief: "An expression describes a calculation. A variable marks a value you can choose or measure; substituting a value turns the expression into arithmetic.",
      key: "Substitute with parentheses, evaluate powers, then multiply and divide before adding and subtracting.",
      full: {
        professor: "Start with arithmetic you can explain. The letter is a placeholder, not a new kind of number. Parentheses protect the value you put in its place.",
        objectives: ["Evaluate an expression at a positive or negative input.", "Distinguish an expression from an equation.", "Explain why parentheses matter for a negative input."],
        lecture: [["A rule for a calculation", "The expression 3x + 2 means multiply the input by 3, then add 2. At x = 4 it gives 14. It becomes an equation when we assert equality, such as 3x + 2 = 14."],
          ["Keep the sign attached", "For x = −2, x² means (−2)² = 4. But −x² means −(x²), which is −4 at that same input. Squaring happens before the outside minus."],
          ["Terms that combine", "2x + 3x = 5x because both terms count copies of the same quantity. 2x + 3 cannot be collapsed to 5x: the second term is a constant."]],
        viz: lab,
        worked: { prompt: "Evaluate 2x² − 3x + 1 at x = −2.", steps: [["Replace each x with (−2).", "2(−2)² − 3(−2) + 1."], ["Evaluate the square and products.", "2 · 4 + 6 + 1."], ["Add.", "8 + 6 + 1 = 15."]] },
        turn: [numeric("Evaluate 4x − 1 at x = 3.", 11, "4(3) − 1 = 12 − 1 = 11."), numeric("Evaluate x² + 2 at x = −3.", 11, "(−3)² + 2 = 9 + 2 = 11.")],
        homework: { title: "Substitution practice", gen: [() => numeric("Evaluate 5x + 2 at x = −2.", -8, "−10 + 2 = −8."), () => numeric("Evaluate 3x² at x = −2.", 12, "3 · 4 = 12.")] }
      },
      qs: [{ q: "At x = −3, what is 2x² + 1?", opts: ["−17", "19", "37"], a: 1, why: "The square is 9, so 2 · 9 + 1 = 19." },
        { q: "Which simplifies to 7x?", opts: ["3x + 4", "3 + 4x", "3x + 4x"], a: 2, why: "Only like terms count copies of the same x." },
        { q: "Which is an equation?", opts: ["2x + 1", "2x + 1 = 7", "x²"], a: 1, why: "An equation asserts equality between two expressions." }]
    },
    { n: "1.2", t: "Linear equations and checking solutions",
      brief: "A solution is a value that makes an equation true. Keep the two sides equal by applying the same reversible operation to both sides.",
      key: "Undo addition or subtraction, then multiplication or division. Check the result in the original equation.",
      full: {
        professor: "Solving is a chain of equalities you can defend. Never trust a value merely because it is at the end of your working: substitute it into the original question.",
        objectives: ["Solve an equation with one unknown and nonzero linear coefficient.", "Distribute before collecting terms.", "Verify a proposed solution by substitution."],
        lecture: [["Preserving equality", "From 3x + 5 = 20, subtract 5 on both sides to obtain 3x = 15. Divide both sides by 3 to obtain x = 5. Each step preserves exactly the same solutions."],
          ["Distribute first", "2(x − 3) = 10 becomes 2x − 6 = 10. The multiplier applies to both terms in parentheses. Add 6 and divide by 2 to get x = 8."],
          ["Check, and notice exceptions", "For x = 8, 2(8 − 3) = 10, so the check passes. An equation can also have no solution (x = x + 1) or every real number as a solution (2x = 2x). Dividing by zero is never an allowed step."]],
        viz: lab,
        worked: { prompt: "Solve 4x − 7 = 9.", steps: [["Undo subtracting 7.", "Add 7 to both sides: 4x = 16."], ["Undo multiplying by 4.", "Divide by 4: x = 4."], ["Check in the original equation.", "4(4) − 7 = 16 − 7 = 9, which matches the right side."]] },
        turn: [numeric("Solve 5x + 2 = 17. Enter x.", 3, "Subtract 2: 5x = 15. Divide by 5: x = 3."), numeric("Solve 3(x − 1) = 12. Enter x.", 5, "Divide by 3: x − 1 = 4. Add 1: x = 5.")],
        homework: { title: "Solve and verify", gen: [() => numeric("Solve 2x − 8 = 6.", 7, "2x = 14."), () => numeric("Solve 4(x + 2) = 4.", -1, "x + 2 = 1.")] }
      },
      qs: [{ q: "What solves 3x − 4 = 11?", opts: ["5", "7/3", "−5"], a: 0, why: "3x = 15, so x = 5; 3(5) − 4 = 11." },
        { q: "Distribute 3(x + 2).", opts: ["3x + 2", "3x + 6", "x + 6"], a: 1, why: "Multiply each term inside the parentheses by 3." },
        { q: "How many solutions does x = x + 1 have?", opts: ["One", "Every real number", "None"], a: 2, why: "Subtracting x would require 0 = 1, which is false." }]
    },
    { n: "1.3", t: "Functions and linear models",
      brief: "A function assigns one output to each allowed input. A linear model y = mx + b combines a constant rate of change with an initial value.",
      key: "Slope m is change in output divided by change in input. The intercept b is the output when the input is zero.",
      full: {
        professor: "Now the algebra tells a story. Name the units, say what zero means, and ask where the model is reasonable before computing an answer.",
        objectives: ["Evaluate a linear function.", "Find a slope from two points.", "Interpret an intercept and restrict a model's domain in context."],
        lecture: [["Function notation", "f(x) = 2x + 3 names a rule. f(4) asks for the output at input 4, so f(4) = 11. f(x) is not multiplication by f. A rule can assign the same output to several inputs, but never two outputs to one input."],
          ["Rate and starting value", "A bike rental costs C(h) = 6h + 10 dollars for h hours. The 10-dollar intercept is a fixed fee; the slope is 6 dollars per hour. At h = 2, C(2) = 22 dollars."],
          ["Reasonable inputs", "Rental time cannot be negative. If the shop closes after 8 hours, a model for that day uses 0 ≤ h ≤ 8. Algebra alone does not supply these practical limits."]],
        viz: lab,
        worked: { prompt: "A line passes through (1, 5) and (3, 11). Find y = mx + b.", steps: [["Compute rise over run.", "m = (11 − 5)/(3 − 1) = 6/2 = 3."], ["Use either point to find b.", "5 = 3(1) + b, so b = 2."], ["Check both points.", "y = 3x + 2 gives 5 at x = 1 and 11 at x = 3."]] },
        turn: [numeric("For f(x) = 4x + 2, find f(3).", 14, "4(3) + 2 = 14."), numeric("Find the slope through (0, 1) and (2, 7).", 3, "(7 − 1)/(2 − 0) = 3.")],
        homework: { title: "Rates with meaning", gen: [() => numeric("A rental costs C(h) = 5h + 8 dollars. What is C(3)?", 23, "15 + 8 = 23."), () => numeric("For y = 2x + b through (3, 10), find b.", 4, "10 = 6 + b.")] }
      },
      qs: [{ q: "For C(h) = 6h + 10, what does 10 represent?", opts: ["Dollars per hour", "The fixed fee in dollars", "The maximum hours"], a: 1, why: "C(0) = 10: the charge before hourly costs." },
        { q: "Which slope joins (2, 7) and (5, 16)?", opts: ["3", "9", "1/3"], a: 0, why: "The output rises 9 while the input rises 3; 9/3 = 3." },
        { q: "Can one function input have two different outputs?", opts: ["Yes", "No"], a: 1, why: "A function assigns exactly one output to each allowed input." }]
    }
  ] }]
};

INTRO_MATH.units.push(prerequisites, equations, functions, polynomials, exponentials, systems, matrices, conics, sequences, probability, geometry, finalReview);
// Reuse relevant interactive models; reading-only lessons do not invent a lab.
const models = {
  'CO.1': {kind:'algebraConic', shape:'parabola', note:'Change the distance p from the vertex to the focus. Compare the focus above the vertex with the dashed directrix below it. Both axes use equal scales.'},
  'CO.2': {kind:'algebraConic', shape:'ellipse', note:'Keep the horizontal semiaxis at 5 and change the vertical semiaxis. Watch the two foci move while remaining inside the ellipse. Both axes use equal scales.'},
  'CO.3': {kind:'algebraConic', shape:'hyperbola', note:'Keep a = 2 and change b. The vertices stay fixed while the foci and the dashed asymptotes change. Both axes use equal scales.'},
  'FN.1': {kind:'vline', note:'Move a vertical line across an ordinary parabola and a sideways parabola. Count how many outputs each graph assigns to the selected input.'},
  'FN.3': {kind:'transform', note:'Move the slider to translate the parent parabola. Track its vertex and compare the translated curve with the gray parent.'},
  'PF.1': {kind:'transform', note:'Watch how the vertex determines the minimum and axis of a translated parabola.'},
  'EX.1': {kind:'explog', note:'Change the positive base of an exponential model. Compare growth, decay, and the constant case at base 1.'},
  'EX.3': {kind:'loginv', note:'Compare an exponential with its logarithmic inverse. Their points reflect across the line y = x.'},
};
for (const sec of INTRO_MATH.units.flatMap(u=>u.sections)) if(models[sec.n]) sec.full.viz=models[sec.n];

// Enrich the original opening lessons while retaining their saved IDs and mastery rules.
const opening=INTRO_MATH.units[0].sections;
opening[0].full.lecture.push(
  ['One operation at a time','After substitution, simplify inside parentheses, then powers, then multiplication and division from left to right, and finally addition and subtraction from left to right. Equal-priority operations do not run in a preferred symbol order: 12 ÷ 3 × 2 is 4 × 2 = 8. Write intermediate lines so you can identify the first place two methods disagree.'],
  ['Use units and an estimate','For a cost expression 4n + 6, the coefficient 4 may mean dollars per item and the constant 6 a fixed charge in dollars. At n = 10, estimate that the result is a little above 40 before calculating 46. An estimate will not prove the exact answer, but it can expose a misplaced sign or a forgotten fixed charge.']
);
opening[0].full.examples=[{prompt:'Simplify 2(3x − 4) + x, then evaluate at x = 5.',steps:[['Distribute','6x − 8 + x.'],['Combine like terms','7x − 8; the constant does not combine with the x-terms.'],['Substitute and check','7(5) − 8 = 27. In the original: 2(15 − 4) + 5 = 27.']]}];
opening[1].full.lecture.push(
  ['Variables on both sides','For 5x + 2 = 2x + 14, subtract 2x from both sides before isolating x: 3x + 2 = 14, then 3x = 12 and x = 4. Moving a term is shorthand for performing the same addition or subtraction on both sides; the equality rule supplies the reason for the changed sign.'],
  ['Clear numerical fractions','Multiply an equation by the least common multiple of its numerical denominators to remove fractions. For x/2 + 1/3 = 5/6, multiply every term by 6 to get 3x + 2 = 5, then x = 1. The check is 1/2 + 1/3 = 5/6. A denominator involving the variable also needs an explicit nonzero restriction.']
);
opening[1].full.examples=[{prompt:'Solve 3(x + 2) = x + 14.',steps:[['Distribute','3x + 6 = x + 14.'],['Collect and isolate','Subtract x and 6 from both sides: 2x = 8, so x = 4.'],['Check both sides','3(4 + 2) = 18 and 4 + 14 = 18.']]}];
opening[2].full.lecture.push(
  ['Find a formula from data','Two points with different input coordinates determine one line. Compute the output difference divided by the input difference using the same subtraction order, then substitute one point to find the intercept. If the input coordinates are equal, the line is vertical and cannot be written as a function y = mx + b.'],
  ['Understand the model’s limits','A constant rate is an assumption about the process. A rental business with a daily maximum or a discount after several hours may require a piecewise rule. Test a model against additional observations and restrict its input range to the situation actually described. A formula that can be evaluated is not automatically a reliable prediction.']
);
opening[2].full.examples=[{prompt:'A model costs 18 dollars at 2 hours and 30 dollars at 5 hours. Find the rate and fixed fee.',steps:[['Rate','m = (30 − 18)/(5 − 2) = 4 dollars per hour.'],['Fixed fee','18 = 4(2) + b gives b = 10 dollars.'],['Model and verify','C(h) = 4h + 10; C(5) = 30. This assumes the rate stays constant over the relevant hours.']]}];
