import {L,N,Q,E,chapter} from './lesson-tools.mjs';
export const finalReview=chapter('Course review · Cumulative practice exam',[
L({n:'FINAL.1',t:'College Algebra cumulative practice exam',intro:'Bring the course together in a mixed assessment. Choose methods independently, justify restrictions, and explain the meaning of your answers.',goals:['Select methods across the whole course.','Connect symbolic, graphical, and applied interpretations.','Use a mixed assessment to plan focused revision.'],key:'A complete solution states assumptions, selects a method, shows its work, checks the original conditions, and interprets the result.',read:[
['Prepare a closed-notes attempt','Set aside uninterrupted time and work on paper before opening hints or solutions. The mixed questions below deliberately do not announce every method. Keep a formula sheet separate for a second attempt so you can distinguish recall problems from method-selection problems. This is practice for understanding, not a timed certification exam.'],
['Choose a representation','A formula may simplify through factoring, a function may be clearer from a graph, and an application may need a table or diagram before an equation. Define unknowns and units first. When several relationships act at once, a system may be more natural than forcing everything into one complicated expression.'],
['Carry restrictions throughout','Track nonzero denominators, nonnegative even-root radicands, positive logarithm arguments, and practical limits. Check candidates after operations such as squaring. In a matrix problem, a zero determinant changes the method; in an infinite geometric series, the ratio condition determines whether a sum exists.'],
['Assess a whole answer','An exact symbolic value and a rounded numerical estimate can serve different purposes. State units in models, coordinates for points, intervals for inequality solutions, and assumptions for probability. A correct intermediate number is not a complete answer if the question asks for a different quantity.'],
['Turn results into revision','Record each missed problem beside its chapter: prerequisites, equations, functions, polynomials, exponential models, systems, matrices, conics, sequences, probability, or geometry. Revisit one worked example there, explain the corrected reasoning aloud, and solve a fresh problem before repeating the cumulative set. Use earned practice progress to distinguish solving a question from revealing its answer.']
],examples:[E('A rectangular garden uses 36 m of fencing. Find its largest possible area.',['Represent the constraint','Let width be x and length 18−x, with 0<x<18.'],['Choose the model','A=x(18−x)=−(x−9)²+81.'],['Interpret and check','Maximum area 81 m² occurs at a 9-by-9 square, whose perimeter is 36 m.']),E('Solve ln(x−2)+ln(x+2)=ln12.',['Restrict inputs','Both arguments positive requires x>2.'],['Use algebra','ln[(x−2)(x+2)]=ln12 gives x²−4=12, so x=±4.'],['Return to the original','Only 4 satisfies x>2. The arguments 2 and 6 give the required product 12.'])],practice:[
N('Simplify 3(2x−5)−2(x+1), then evaluate at x=6.',7,'The expression is 6x−15−2x−2=4x−17. At 6 it equals 24−17=7.'),
N('Solve 5(x−2)=3x+8.',9,'5x−10=3x+8 → 2x=18 → x=9. Check both sides equal 35.'),
N('Find the positive root of x²−7x+10=0 that is larger than the other root.',5,'Factor (x−5)(x−2)=0. The larger root is 5.'),
N('Find the slope through (−1,4) and (3,−8).',-3,'(−8−4)/(3−(−1))=−12/4=−3.'),
N('Find the lower endpoint of |2x−4|≤6.',-1,'−6≤2x−4≤6 → −2≤2x≤10 → −1≤x≤5.'),
N('Find the minimum output of f(x)=2(x−3)²+7.',7,'The square is nonnegative and zero at 3, so the minimum output is 7.'),
N('For f(x)=x²+1 and g(x)=2x−3, find f(g(4)).',26,'g(4)=5, then f(5)=25+1=26.'),
N('For f(x)=5x+2, find f⁻¹(17).',3,'Solve 5x+2=17 to get x=3.'),
N('Find the hole output for (x²−9)/(x−3).',6,'The reduced expression is x+3, but x=3 is excluded. The hole is at (3,6).'),
N('Find the remainder when x³+2x−5 is divided by x−2.',7,'By the remainder theorem P(2)=8+4−5=7.'),
N('An amount of 250 grows by 20% per period. Find it after 2 periods.',360,'250(1.2)²=250(1.44)=360.'),
N('Solve log₂(x−1)=4.',17,'x−1=2⁴=16, so x=17; its argument is positive.'),
N('Solve x+y=11 and 2x−y=7. Enter x.',6,'Adding gives 3x=18, so x=6 and y=5.'),
N('Solve y=x² and y=2x+3. Enter the smaller intersection input.',-1,'x²−2x−3=(x−3)(x+1)=0, so the smaller input is −1.'),
N('Find det[[5,2],[3,4]].',14,'5·4−2·3=20−6=14.'),
N('For A=[[1,2],[0,1]], find entry (1,2) of A⁻¹.',-2,'The determinant is 1; the inverse is [[1,−2],[0,1]].'),
N('For x²/100+y²/64=1, find the focal distance c.',6,'Ellipse: c²=100−64=36, so c=6.'),
N('For y²/25−x²/144=1, find focal distance c.',13,'Hyperbola: c²=25+144=169, so c=13.'),
N('Find the 12th term of an arithmetic sequence with a₁=5,d=4.',49,'a₁₂=5+11(4)=49.'),
N('Find the infinite geometric sum with a₁=15,r=0.4.',25,'|r|<1 and S=15/(1−0.4)=15/0.6=25.'),
N('How many unordered committees of 2 can be chosen from 9 people?',36,'C(9,2)=9·8/2=36.'),
N('Find P(exactly one head in 3 fair independent tosses).',0.375,'C(3,1)(1/2)³=3/8=0.375.'),
N('A right triangle has legs 20 and 21. Find its hypotenuse.',29,'√(400+441)=√841=29.'),
N('A cylinder has radius 2 and height 9. Enter the coefficient of π in its volume.',36,'V=πr²h=π·4·9=36π.')
],check:[Q('Which check is essential after solving a logarithmic equation?',['All original arguments are positive','Only the final product is positive','Every answer is an integer'],0,'Separate arguments may be invalid even when their product is positive.'),Q('A rational graph has a common cancelled factor. What remains necessary?',['Preserve the original exclusion','Restore that input','Remove all intercepts'],0,'Cancellation does not change the original domain.'),Q('A matrix determinant is zero. What follows?',['The inverse does not exist','Every associated system has no solution','The matrix is the identity'],0,'A singular matrix cannot be inverted; its systems can be inconsistent or dependent.'),Q('Which condition permits a finite infinite geometric sum for nonzero first term?',['|r|<1','r>1','r=−1'],0,'The geometric remainder tends to zero exactly in this range.'),Q('Selecting a group without roles uses…',['Combinations','Permutations','A sum of factorials'],0,'The order of the same members does not create a different group.'),Q('A model’s algebraic answer should also be checked for…',['Units and practical restrictions','Matching a screenshot exactly','Being positive in every problem'],0,'A mathematical solution must answer the actual quantities and conditions stated.')] })
]);
