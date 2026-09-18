/** Original teaching and exercises for the Chapter 1 scope supplied by the learner.
 * G.1–G.11 retain their stored identities; G.12 adds variation before the data extension.
 * Enrich before the chapter review is built so new material is assessed there too. */
import {L,N,Q,E} from './lesson-tools.mjs';

const additions = {
  'G.1': {
    read: [
      ['Apply coordinates to a map', 'Choose an origin, directions, and a scale before assigning coordinates to locations. If one coordinate unit represents 100 meters, multiply a coordinate distance by 100 to get meters. The distance formula measures a straight route; a route restricted to horizontal and vertical streets instead adds the absolute horizontal and vertical changes. State which distance the situation asks for.'],
      ['Discuss and prove: why averaging finds the midpoint', 'Try to explain the midpoint formula without relying on a memorized rule. From A = (a,b) to B = (c,d), the displacement is (c − a,d − b). Half that displacement added to A is (a + (c − a)/2,b + (d − b)/2), which simplifies to ((a + c)/2,(b + d)/2). The same half-displacement remains from the midpoint to B. This also shows why averaging works when an endpoint is negative.']
    ],
    examples: [E('A map uses 100 meters per unit. Compare the straight and street-grid routes from (−1,2) to (5,10).',
      ['Find the changes', 'Δx = 6 and Δy = 8 coordinate units.'],
      ['Measure straight-line distance', '√(6² + 8²) = 10 units, or 1,000 meters.'],
      ['Measure the grid route', '(6 + 8) × 100 = 1,400 meters. It is 400 meters longer; a straight-line formula does not measure a street-constrained route.'])],
    practice: [
      N('Skills Plus — A segment has midpoint (2,−1) and endpoint (−4,3). Find the other endpoint’s y-coordinate.', -5, '(3 + y)/2 = −1 gives 3 + y = −2, so y = −5. The other x-coordinate is 8; averaging the two endpoints gives (2,−1).'),
      N('Application — On a map with 50 meters per unit, locations are (1,1) and (4,5). Find their straight-line separation in meters.', 250, 'The changes are 3 and 4. Distance is √(9 + 16) = 5 coordinate units. Multiply by 50 meters per unit to obtain 250 meters.')
    ]
  },
  'G.2': {
    read: [
      ['Plot points without inventing a graph', 'For y = x² − 4, a table at x = −3, −2, −1, 0, 1, 2, 3 gives y = 5, 0, −3, −4, −3, 0, 5. Plot each ordered pair with labeled axes. The equation and symmetry justify a smooth parabola, not straight segments between the samples. A finite table alone cannot establish every detail of an unknown relationship.'],
      ['Discuss and test all three symmetries', 'For x² + y² = 9, replacing x with −x, y with −y, or both leaves the equation unchanged: all three symmetry tests pass. For y = x³, replacing both gives −y = −x³, equivalent to the original, so origin symmetry holds. Replacing x alone does not give the same graph. A symmetric-looking screen is evidence to test, not a substitute for an algebraic argument.']
    ],
    examples: [E('Build a table and sketch y = x² − 4 using intercepts and symmetry.',
      ['Calculate points', 'At x = −2, −1, 0, 1, 2, the outputs are 0, −3, −4, −3, 0. Plot (−2,0), (−1,−3), (0,−4), (1,−3), (2,0).'],
      ['Find the landmarks', 'The x-intercepts are (−2,0) and (2,0); the y-intercept and lowest point are (0,−4), since x² ≥ 0.'],
      ['Use symmetry', 'Replacing x by −x does not change x². Draw the two matching sides of an upward parabola about the y-axis.'])],
    practice: [
      N('Skills Plus — For x² + y² = 25, find the positive y-coordinate when x = −3.', 4, '9 + y² = 25 gives y² = 16, so y = ±4. The requested positive coordinate is 4; both (−3,4) and (−3,−4) lie on the full graph.'),
      N('Application — A supply tank follows V = 120 − 8t liters while draining. Find the time-axis intercept in minutes.', 15, 'At the time-axis intercept V = 0. Solve 120 − 8t = 0 to obtain t = 15. The point is (15,0); this model is physically meaningful only through emptying.')
    ],
    check: [Q('Which substitution tests symmetry about the x-axis?', ['Replace x with −x only', 'Replace y with −y only', 'Exchange x and y'], 1, 'Reflection across the x-axis keeps the horizontal coordinate and reverses the vertical one.')]
  },
  'G.3': {
    read: [
      ['Recognize, then verify a circle', 'For A(x² + y²) + Dx + Ey + F = 0 with A ≠ 0, divide every term by A before completing squares. Equal square coefficients and no xy term identify a candidate, but the final radius squared decides whether it is a circle, one point, or no real graph. Unequal square coefficients generally indicate a different conic, not a circle of an unusual radius.'],
      ['Discuss and discover: a boundary versus a region', 'Compare (x − 2)² + (y + 1)² = 9 with the same left side ≤ 9. The equation contains points exactly 3 units from (2,−1), so it describes the boundary circle. The inequality also includes points closer to the center and describes the filled disk. Explain why the center satisfies the inequality but cannot satisfy the equation when the radius is positive.']
    ],
    examples: [
      E('Recognize the graph of 2x² + 2y² − 8x + 12y + 18 = 0.',
        ['Normalize and group', 'Divide by 2: x² − 4x + y² + 6y = −9.'],
        ['Complete the squares', 'Add 4 + 9 to both sides: (x − 2)² + (y + 3)² = 4.'],
        ['Classify', 'The positive right side gives center (2,−3) and radius 2. Equal square coefficients alone were not the final check.']),
      E('Classify x² + y² − 2x + 4y + 6 = 0 over the reals.',
        ['Group', 'x² − 2x + y² + 4y = −6.'],
        ['Complete squares', '(x − 1)² + (y + 2)² = −6 + 1 + 4 = −1.'],
        ['Use nonnegativity', 'There are no real points. If the right side had been 0, there would be only the point (1,−2), not a positive-radius circle.'])
    ],
    practice: [
      N('Skills Plus — Find the radius of 3x² + 3y² + 6x − 12y − 12 = 0.', 3, 'Divide by 3: x² + 2x + y² − 4y = 4. Add 1 and 4: (x + 1)² + (y − 2)² = 9. Thus r = 3.'),
      N('Application — A circular garden has diameter endpoints (−2,1) and (6,7), in meters. Find its radius.', 5, 'The diameter length is √(8² + 6²) = 10 meters. The radius is half, 5 meters. The center is the midpoint (2,4), so its equation is (x − 2)² + (y − 4)² = 25.')
    ]
  },
  'G.4': {
    read: [
      ['The general equation of a line', 'The general form Ax + By + C = 0 requires A and B not both zero. When B ≠ 0, isolate y to get slope −A/B and intercept −C/B. When B = 0 and A ≠ 0, the equation is the vertical line x = −C/A. Standard form Ax + By = C uses a differently signed constant; check which convention is being used before reading an intercept.'],
      ['Discuss and prove: slope does not depend on the chosen pair', 'Take two distinct points on y = mx + b. Their output difference is (mx₂ + b) − (mx₁ + b) = m(x₂ − x₁). Dividing by the nonzero input difference gives m. This explains why every pair gives the same slope on a nonvertical line. It also explains why the same argument cannot assign a finite slope to a vertical line.']
    ],
    examples: [
      E('Read 2x − 3y + 6 = 0 and find a parallel line through (3,1).',
        ['Isolate y', '−3y = −2x − 6, so y = (2/3)x + 2. The slope is 2/3.'],
        ['Keep the slope', 'A parallel line through (3,1) is y − 1 = (2/3)(x − 3).'],
        ['Check its position', 'It simplifies to y = (2/3)x − 1. At x = 3 it gives 1; its different intercept makes it distinct from the original.']),
      E('Find the line through (4,−2) perpendicular to y = 7.',
        ['Identify the given line', 'y = 7 is horizontal with slope 0.'],
        ['Use geometry, not division by zero', 'A line perpendicular to a horizontal line is vertical, so its x-coordinate is constant.'],
        ['Use the point', 'The required equation is x = 4. It contains (4,−2) and has undefined slope, not slope 0.'])
    ],
    practice: [
      N('Skills Plus — Find the slope of 6x + 3y − 12 = 0.', -2, 'Isolate y: 3y = −6x + 12, so y = −2x + 4. Equivalently m = −A/B = −6/3 = −2.'),
      N('Application — A rental costs $26 for 2 hours and $44 for 5 hours at a constant hourly rate. Find the fixed fee in dollars.', 14, 'Slope = (44 − 26)/(5 − 2) = 6 dollars per hour. Use 26 = 6(2) + b, giving b = 14. The model C = 6h + 14 matches both observations.')
    ]
  },
  'G.5': {
    read: [
      ['Choosing a method and deriving the formula', 'Use factoring when factors are easy to see, square roots when a square is isolated, and the quadratic formula for any coefficients with a ≠ 0. To derive it, divide ax² + bx + c = 0 by a, move c/a, and add (b/(2a))². This gives (x + b/(2a))² = (b² − 4ac)/(4a²). Taking both roots and isolating x gives the familiar formula; the ± accounts for either sign of a.'],
      ['Modeling with quadratic equations', 'Name the unknown and its units, state any physical restrictions, then translate the relationship into an equation. Area often multiplies two variable lengths; motion can involve a squared time. After solving, test every candidate against the context and the original equation. A negative root is a valid algebraic result but cannot represent an ordinary positive length or elapsed time.'],
      ['Discuss and prove: what the discriminant tells you', 'Use the completed-square equation (x + b/(2a))² = D/(4a²) to explain the three real-root cases. Since 4a² is positive, the right side has the sign of D. A positive right side has two opposite square roots, zero has only one, and a negative right side has no real square root. Connect each case to a parabola crossing, touching, or missing the horizontal axis.']
    ],
    examples: [
      E('Solve 3x² + 2x − 2 = 0 with the quadratic formula.',
        ['Identify coefficients', 'a = 3, b = 2, c = −2, so D = 2² − 4(3)(−2) = 28 > 0. There are two distinct real roots.'],
        ['Substitute before simplifying', 'x = (−2 ± √28)/6 = (−2 ± 2√7)/6.'],
        ['State and check the exact roots', 'x = (−1 ± √7)/3. For either root, (3x + 1)² = 7, which expands to 9x² + 6x − 6 = 0, or three times the original equation.']),
      E('A rectangle is 3 meters longer than it is wide and has area 40 m². Find both dimensions.',
        ['Build the model', 'Let w > 0 be the width in meters. Then length is w + 3 and w(w + 3) = 40.'],
        ['Solve', 'w² + 3w − 40 = (w + 8)(w − 5) = 0 gives w = −8 or 5.'],
        ['Apply the context and verify', 'Reject −8 as a width. Width is 5 m, length is 8 m, and 5 × 8 = 40 m².'])
    ],
    practice: [
      N('Skills Plus — Use the quadratic formula to find the smaller root of 3x² + x − 2 = 0.', -1, 'D = 1 − 4(3)(−2) = 25. x = (−1 ± 5)/6 gives 2/3 and −1. The smaller root is −1.'),
      N('Application — A rectangle is 2 meters longer than it is wide, with area 48 m². Find its positive width in meters.', 6, 'Let w > 0. Then w(w + 2) = 48, so (w + 8)(w − 6) = 0. Reject −8; width 6 and length 8 give the required area.')
    ]
  },
  'G.6': {
    read: [
      ['Square roots of negative numbers', 'For a positive real a, the principal square root of −a is i√a. Simplify √a as usual, so √(−72) = 6i√2. Do not apply √u√v = √(uv) blindly to negative radicands: √(−4)√(−9) = (2i)(3i) = −6, whereas √36 = 6. Rewrite negative square roots using i before multiplying.'],
      ['Discuss and verify a complex answer', 'Checking a complex root uses the same substitution principle as checking a real root, with i² replaced by −1 after multiplication. For x = 2 + 3i in x² − 4x + 13, the terms are (−5 + 12i) − (8 + 12i) + 13 = 0. Both the real and imaginary components vanish. A decimal check of only the real component would not be sufficient.']
    ],
    examples: [
      E('Divide (3 + 2i)/(1 − i) and write a + bi.',
        ['Use the conjugate', 'Multiply numerator and denominator by 1 + i. This multiplies the fraction by 1 because 1 + i is nonzero.'],
        ['Expand both products', '(3 + 2i)(1 + i) = 3 + 5i + 2i² = 1 + 5i. The denominator is (1 − i)(1 + i) = 1 − i² = 2.'],
        ['Divide and verify', 'The result is 1/2 + (5/2)i. Multiplying it by 1 − i recovers 3 + 2i.']),
      E('Simplify √(−12)√(−3).',
        ['Rewrite each radical', '√(−12) = 2i√3 and √(−3) = i√3.'],
        ['Multiply', '(2i√3)(i√3) = 2i² × 3.'],
        ['Use i² = −1', 'The result is −6. Taking √36 instead would incorrectly use a real-radical identity outside its conditions.'])
    ],
    practice: [
      N('Skills Plus — Find the imaginary coefficient b in (4 + i)/(1 − 2i) = a + bi.', 1.8, 'Multiply by 1 + 2i: numerator 4 + 9i + 2i² = 2 + 9i; denominator 1 + 4 = 5. The result is 2/5 + (9/5)i, so b = 9/5.'),
      N('Application — An algebraic model has x² + 6x + 13 = 0. For the root with positive imaginary part, find b in x = −3 + bi.', 2, 'Complete the square: (x + 3)² = −4, so x + 3 = ±2i. The root with positive imaginary coefficient is −3 + 2i. There are no real roots.')
    ]
  },
  'G.7': {
    read: [
      ['Modeling with rational equations', 'For a fixed job, rates add; times do not. If one machine finishes in a hours and another in b hours, their rates are 1/a and 1/b jobs per hour. Working together for t hours completes t/a + t/b jobs, so a one-job equation is 1/a + 1/b = 1/t. Require positive times and constant rates. The combined completion time should be shorter than either individual time.'],
      ['Discuss: why a canceled denominator still matters', 'Consider (x² − 1)/(x − 1) = 2. The original domain excludes x = 1. Canceling gives x + 1 = 2 only for x ≠ 1, and the only candidate is precisely the excluded value. Therefore the original equation has no solution. Cancellation preserves values on the original domain; it never gives permission to fill a missing input.']
    ],
    examples: [
      E('Solve 1/(x − 1) + 1/(x + 1) = 3/4.',
        ['Restrict and clear denominators', 'x ≠ 1,−1. Multiply every term by 4(x − 1)(x + 1): 4(x + 1) + 4(x − 1) = 3(x² − 1).'],
        ['Solve the quadratic', '3x² − 8x − 3 = (3x + 1)(x − 3) = 0, giving x = −1/3 or 3. Neither is excluded.'],
        ['Check in the fractions', 'At 3: 1/2 + 1/4 = 3/4. At −1/3: −3/4 + 3/2 = 3/4. Both are solutions.'])],
    practice: [
      N('Skills Plus — How many real solutions does (x² − 1)/(x − 1) = 2 have?', 0, 'The original denominator excludes 1. For allowed inputs the equation becomes x + 1 = 2, whose only candidate is 1. Since that candidate is excluded, the solution set is empty.'),
      N('Application — Two pumps fill a tank in 6 hours and 3 hours individually. With constant rates and no losses, how many hours do they take together?', 2, 'Their combined rate is 1/6 + 1/3 = 1/2 tank per hour. Solve (1/2)t = 1 to obtain t = 2 hours. This is shorter than either individual filling time.')
    ]
  },
  'G.8': {
    read: [
      ['Modeling with inequalities', 'Translate a limit carefully: at most means ≤, at least means ≥, and more than means >. A rental with a $15 fixed charge and $8 hourly charge fits a $55 budget when 15 + 8h ≤ 55. Solving gives h ≤ 5, but elapsed time also requires h ≥ 0, so the model’s answer is [0,5]. If only whole units are sold, restrict the final set to the permitted integers.'],
      ['Discuss: a sign chart is an interval argument', 'A polynomial is continuous, and between consecutive real zeros none of its factors passes through zero. Thus its sign stays constant there. A rational expression also needs denominator zeros as boundaries because it is not continuous at those inputs. Explain why testing x = 0 alone cannot justify an answer spanning a denominator zero at x = 4.']
    ],
    examples: [
      E('Solve (x + 1)/(x − 4) ≥ 0.',
        ['Mark every boundary', 'The numerator is zero at −1; the denominator is zero at 4, which is excluded. Split into (−∞,−1), (−1,4), and (4,∞).'],
        ['Test signs', 'At −2 the quotient is positive; at 0 it is negative; at 5 it is positive. At −1 the quotient is 0.'],
        ['Assemble the set', 'The solution is (−∞,−1] ∪ (4,∞). Include the numerator zero for ≥, but never include the undefined input 4.']),
      E('A club has $95 for a $20 setup fee and $12 per attendee. What whole-number attendance can it afford?',
        ['Translate the budget', '20 + 12n ≤ 95, with n a nonnegative integer.'],
        ['Solve the inequality', '12n ≤ 75, so n ≤ 6.25.'],
        ['Apply the domain', 'The possible values are 0,1,2,3,4,5,6. Six costs $92; seven costs $104 and exceeds the budget.'])
    ],
    practice: [
      N('Skills Plus — How many integer inputs solve (x − 1)(x − 4) ≤ 0?', 4, 'The upward quadratic is nonpositive on [1,4]. The included integers are 1,2,3,4, so there are four.'),
      N('Application — A $10 setup charge plus $7 per item must total at most $60. Find the largest whole number of items.', 7, '10 + 7n ≤ 60 gives n ≤ 50/7 ≈ 7.14. Since n is a nonnegative integer, the maximum is 7. Seven costs $59 and eight costs $66.')
    ]
  },
  'G.9': {
    read: [
      ['Modeling a tolerance with absolute value', 'If a manufactured part should measure 12 centimeters with an allowed error of at most 0.2 centimeter, its length L satisfies |L − 12| ≤ 0.2. This is equivalent to 11.8 ≤ L ≤ 12.2. A requirement that a reading be outside the allowed band uses |L − 12| > 0.2 instead. Equality determines whether the boundary is accepted.'],
      ['Discuss and write: why “outside” uses or', 'Sketch the points whose distance from 3 exceeds 2. A point may be less than 1 or greater than 5, but it cannot satisfy both conditions at once. Joining the cases with and would incorrectly produce the empty set. Explain the difference between |x − 3| > 2 and |x − 3| ≤ 2 using both a number-line description and interval notation.']
    ],
    examples: [
      E('Solve |3x + 1| > 7.',
        ['Make the outside cases', '3x + 1 < −7 or 3x + 1 > 7.'],
        ['Solve each separately', '3x < −8 gives x < −8/3; 3x > 6 gives x > 2.'],
        ['State and test', '(−∞,−8/3) ∪ (2,∞). The middle point x = 0 gives 1 > 7, false; x = 3 gives 10 > 7, true.']),
      E('A part is acceptable within 0.2 cm of 12 cm. Express the tolerance and test a 12.15 cm part.',
        ['Write a distance condition', '|L − 12| ≤ 0.2.'],
        ['Solve the compound inequality', '−0.2 ≤ L − 12 ≤ 0.2 gives 11.8 ≤ L ≤ 12.2.'],
        ['Check the part', '|12.15 − 12| = 0.15 ≤ 0.2, so it is acceptable under the stated specification.'])
    ],
    practice: [
      N('Skills Plus — For |3x + 1| > 7, find the boundary of the left-hand ray.', -8/3, 'The left case is 3x + 1 < −7, hence x < −8/3. This boundary is not included because the inequality is strict.'),
      N('Application — A rod must be within 0.4 cm of 20 cm, including the limits. Find its maximum permitted length in centimeters.', 20.4, '|L − 20| ≤ 0.4 gives 19.6 ≤ L ≤ 20.4. The upper boundary is included, so the maximum permitted length is 20.4 cm.')
    ]
  },
  'G.10': {
    read: [
      ['Using graphing devices', 'Enter the two sides as separate functions, such as Y₁ = X² and Y₂ = X + 2. Use parentheses around complete numerators, denominators, and negative inputs. Start with x from −4 to 4 and y from −3 to 8, then display a table alongside the graph. Use the device’s intersection command near each crossing and record the x-coordinate, not just the y-value. Menu names vary; the equation, window, table, and intersection steps do not.'],
      ['A graphing-device workflow for inequalities', 'First find all visible intersections and domain breaks. Use test inputs between successive boundaries to decide which graph is higher, then translate the selected intervals into notation with correct endpoints. Widen or shift the window to look for missed regions. A near-vertical trace may be an asymptote, not a root. Check suspected solutions in the original formulas, and report any numerical endpoints as approximations.'],
      ['Discuss and discover: a missed double root', 'Graph y = (x − 1)² with a coarse table that uses only the inputs 0 and 2. Both outputs are 1, yet x = 1 is a root. The graph touches the axis there without changing sign. Explain why a search based only on sign changes can miss this solution, and why a closer table or algebraic factorization finds it.']
    ],
    examples: [
      E('Use a graphing device to solve x² = x + 2, then verify the answers.',
        ['Enter and set the window', 'Graph Y₁ = X² and Y₂ = X + 2 over −4 ≤ X ≤ 4 and −3 ≤ Y ≤ 8. A table near X = −1 and 2 shows matching outputs.'],
        ['Read both intersections', 'The points are (−1,1) and (2,4). The equation asks for their input values, x = −1 and x = 2.'],
        ['Verify and distinguish inequalities', 'At −1, both sides equal 1; at 2, both equal 4. Between these inputs the parabola lies below the line, so x² < x + 2 has (−1,2), excluding the equality points.'])],
    practice: [
      N('Skills Plus — A device reports the intersection (−1,1) of y = x² and y = x + 2. Which value solves the equation x² = x + 2 at this intersection?', -1, 'The equation’s unknown is the input x, so take −1, not the common output 1. Check (−1)² = 1 and −1 + 2 = 1.'),
      N('Application — Revenue R(x) = 12x and cost C(x) = 5x + 35 are graphed for x ≥ 0. Find the break-even input.', 5, 'At their intersection 12x = 5x + 35, giving 7x = 35 and x = 5. Both outputs are 60. Revenue exceeds cost to the right of 5; the intersection itself is break-even.')
    ]
  }
};

const variation = L({
  n:'G.12', t:'Modeling variation: direct, inverse, joint, and combined',
  intro:'A variation model says how changing one quantity changes another. Translate the relationship, determine its constant from data, and use the same constant only while the model’s assumptions hold.',
  goals:['Recognize and model direct and inverse variation.', 'Determine a constant of variation with units.', 'Combine direct, inverse, and power relationships.', 'Check predictions and explain how scaling changes the output.'],
  key:'Direct: y = kx. Inverse: y = k/x (x ≠ 0). Joint: y = kxz. Combined, for example: y = kx/z² (z ≠ 0). Find k from known data before predicting.',
  read:[
    ['Direct variation', 'When y varies directly with x, y = kx for a fixed constant k. For x ≠ 0, the ratio y/x is constant. Doubling x doubles y, and the mathematical graph is a line through the origin. A contextual domain may restrict which points on that line are meaningful. The rule y = 3x + 5 is linear but not direct variation because its fixed offset prevents y/x from being constant.'],
    ['Find and interpret the constant', 'If a constant-rate machine makes 45 parts in 3 hours, p = kt gives k = 45/3 = 15 parts per hour. Then p = 15t predicts 75 parts in 5 hours. Substituting the supplied pair determines k, including its units; k is not automatically one. Check that another observed pair has the same ratio before treating direct variation as a reliable model.'],
    ['Inverse variation', 'When y varies inversely with x, y = k/x for x ≠ 0, so the product xy is constant. For a fixed 120-kilometer trip at constant speed v > 0, time t = 120/v hours. Doubling the speed halves the time. The mathematical graph has separate branches rather than a line through the origin. A nonzero model cannot include x = 0, and a practical model may allow only the positive branch.'],
    ['Powers change the scaling', 'The phrase “varies directly as the square of x” means y = kx², not y = (kx)². “Inversely as the square of x” means y = k/x². Doubling x multiplies a direct-square output by 4 and an inverse-square output by 1/4. Record which quantity is squared before solving for the constant. For real-valued physical models, also state any positivity conditions on measurements.'],
    ['Joint variation', 'When y varies jointly with x and z, y = kxz. Both factors appear in a single product with one constant. Holding z fixed, doubling x doubles y; doubling both x and z multiplies y by 4. For a rectangular prism with fixed height, volume varies jointly with its length and width, and k is the fixed height. A change in the supposedly fixed height would require a different model.'],
    ['Combining different types of variation', 'If y varies directly with x and inversely with z², write y = kx/z² with z ≠ 0. Substitute a complete known set of x,y,z to determine k, then use the formula for new inputs. If x triples and z doubles, the output is multiplied by 3/4, not by 3/2. When several quantities change, account for all of their factors before interpreting the result.'],
    ['Recognize a model from data', 'For inputs 1,2,4 and outputs 12,6,3, the products are all 12, so inverse variation fits; the output-to-input ratios are not constant. For outputs 3,6,12 at those same inputs, the ratios are all 3, so direct variation fits. Measurements with noise may only approximately fit either rule. A few matching observations support a model within its intended range, not a universal law.'],
    ['Discuss and prove a scaling rule', 'Suppose y = kx/z² with nonzero output and nonzero z. Replace x by ax and z by bz, with b ≠ 0. The new output is k(ax)/(bz)² = (a/b²)(kx/z²) = (a/b²)y. Explain each equality, then predict what happens if both inputs double. The multiplier is 2/4 = 1/2. This reasoning works without knowing k because the same constant appears before and after the change.']
  ],
  examples:[
    E('A steady machine’s production p varies directly with running time t. It makes 45 parts in 3 hours. Predict production in 5 hours.',
      ['Translate', 'p = kt, where p is parts and t is hours. Assume the same steady rate and no downtime.'],
      ['Determine the constant', '45 = k(3), so k = 15 parts per hour.'],
      ['Predict and check', 'p = 15(5) = 75 parts. The known input still gives 15(3) = 45 parts.']),
    E('For a fixed job, completion time t varies inversely with the number n of equally productive workers. Four workers take 6 hours. Predict the time for eight.',
      ['Translate', 't = k/n, for n > 0, assuming divisible work and no interference.'],
      ['Find k', '6 = k/4 gives k = 24 worker-hours.'],
      ['Predict and qualify', 't = 24/8 = 3 hours. Doubling workers halves time under this model; real scheduling constraints could invalidate the assumption.']),
    E('Volume V varies jointly with length l and width w. V = 60 cm³ when l = 5 cm and w = 4 cm. Find V for l = 8 cm and w = 2 cm.',
      ['Write the product', 'V = klw.'],
      ['Calibrate', '60 = k(5)(4), so k = 3 cm, the fixed height.'],
      ['Substitute', 'V = 3(8)(2) = 48 cm³. The length increase does not cancel the width decrease; both must be included.']),
    E('A quantity y varies directly with x and inversely with z². If y = 6 at x = 3 and z = 2, find y at x = 8 and z = 4.',
      ['Translate exactly', 'y = kx/z² with z ≠ 0.'],
      ['Solve for the constant', '6 = 3k/4, so 24 = 3k and k = 8.'],
      ['Predict and check scaling', 'y = 8(8)/4² = 4. Relative to the original, x changes by 8/3 and z by 2, so y changes by (8/3)/4 = 2/3; 6(2/3) = 4.'])
  ],
  practice:[
    N('Skills — y varies directly with x, and y = 18 when x = 6. Find k.', 3, 'Use y = kx. Then 18 = 6k, so k = 3. The model is y = 3x.'),
    N('Skills — y varies directly with x, and y = 18 when x = 6. Find y when x = 10.', 30, 'The same known pair gives k = 18/6 = 3. Substitute x = 10 into y = 3x to obtain y = 30.'),
    N('Skills — y varies inversely with x. If y = 12 at x = 5, find y at x = 15.', 4, 'In y = k/x, k = xy = 5(12) = 60. Thus y = 60/15 = 4. Tripling x divides y by 3.'),
    N('Skills — y varies jointly with x and z. If y = 24 at x = 2 and z = 3, find k.', 4, 'y = kxz gives 24 = k(2)(3). Divide by 6 to find k = 4.'),
    N('Skills Plus — y varies directly as x². If y = 20 when x = 2, find y at x = 5.', 125, 'y = kx², so k = 20/4 = 5. At x = 5 the output is 5(25) = 125.'),
    N('Skills Plus — y = kx/z². If y = 6 at x = 3 and z = 2, find y at x = 8 and z = 4.', 4, '6 = 3k/4 gives k = 8. Then y = 8(8)/16 = 4.'),
    N('Application — At a fixed rate, 90 liters enter a tank in 3 minutes. How many liters enter in 7 minutes?', 210, 'V = kt with k = 90/3 = 30 liters per minute. Therefore V = 30(7) = 210 liters, assuming the rate remains constant.'),
    N('Application — Travel time varies inversely with constant speed for a fixed trip. The trip takes 3 hours at 40 km/h. How many hours at 60 km/h?', 2, 'The fixed distance is k = tv = 3(40) = 120 km. At 60 km/h, t = 120/60 = 2 hours.'),
    N('Skills Plus — A nonzero output follows y = kx/z². Both x and z double. Enter the factor multiplying y.', 0.5, 'The numerator gains a factor of 2 and the denominator a factor of 2² = 4. The total multiplier is 2/4 = 1/2.'),
    N('Application — An idealized intensity I varies inversely as distance squared. I = 80 at distance 2. Find I at distance 4.', 20, 'I = k/d² gives k = 80(2²) = 320. At d = 4, I = 320/16 = 20. Doubling the distance quarters the intensity under the stated model.')
  ],
  check:[
    Q('Which is direct variation of y with x?', ['y = 4x', 'y = 4x + 3', 'y = 4/x'], 0, 'Direct variation has form y = kx with a constant output-to-input ratio and no fixed offset.'),
    Q('Which is constant in inverse variation y = k/x?', ['y/x', 'xy', 'x + y'], 1, 'Multiplying by the nonzero input gives xy = k.'),
    Q('Translate: y varies jointly with x and z and inversely with w.', ['y = k(x + z)/w', 'y = kxz/w', 'y = kw/(xz)'], 1, 'Joint factors multiply in the numerator; inverse factors divide. The domain excludes w = 0.'),
    Q('For y = k/x² with positive x and nonzero y, doubling x changes y by…', ['A factor of 2', 'A factor of 1/2', 'A factor of 1/4'], 2, 'The denominator gains a factor of 4, so the output is divided by 4.')
  ]
});

export function expandChapterOne(lessons){
  for(const lesson of lessons){
    const extra = additions[lesson.n];
    if(!extra) continue;
    lesson.full.lecture.push(...extra.read);
    lesson.full.examples.push(...extra.examples);
    // Append, never reorder existing problem indices: earned answers retain their identity.
    lesson.full.practice.push(...extra.practice);
    lesson.full.homework.gen.push(...extra.practice.map(q => () => ({...q})));
    lesson.qs.push(...(extra.check || []));
  }
  const extension = lessons.findIndex(s => s.n === 'G.11');
  lessons.splice(extension, 0, variation);
  return lessons;
}
