import { INTRO_MATH } from "./intro-math.mjs";
import { INTRO_CS } from "./intro-cs.mjs";
const STUDY = {
  MATH101: INTRO_MATH,
  CS101: INTRO_CS,
  MATH201: { lectures: "Twenty-eight lectures in five units — functions to the Fundamental Theorem.",
  /* grading policy, configurable per course — the gradebook reads this */
  grading: [ ["Homework", "homework", 20], ["Knowledge checks", "quizzes", 10],
             ["Interactive labs", "labs", 10], ["Projects", "projects", 10],
             ["Exam I", "exam1", 20], ["Final examination", "final", 30] ],
  units: [
  { title:"Unit I · Functions & Models", sections:[
    { n:"1.1", t:"Functions and their Representations",
      brief:"A function is a rule that assigns each input exactly one output. The same function can live four ways — a formula, a table, a graph, a sentence — and fluency means moving between them without losing the rule.",
      key:"A curve is a function's graph exactly when every vertical line crosses it at most once.",
      full:{
        professor:"Welcome to Calculus I. Before we touch a limit or a derivative, we spend two weeks making sure the objects we'll be differentiating are second nature. Today's idea sounds almost too simple to need a lecture: a function is a rule with no ambiguity. Hold that thought all semester — every theorem we prove is a promise about rules like this.",
        objectives:[
          "State whether a rule, table, graph or sentence defines a function, and say why.",
          "Evaluate a function from any of its four representations.",
          "Read a function's domain from its formula or its graph." ],
        lecture:[
          ["One input, one output","A vending machine that sometimes gives you crisps and sometimes gives you soup for the same button is broken. A function is the machine that never surprises you: press 4, get f(4), the same f(4) every time. Everything else — notation, graphs, domains — is bookkeeping for that promise."],
          ["'Is a function of'","Each evening the chapel bell rings once per hour struck: the number of chimes is a function of the hour. Each day the dining hall posts one soup: the soup is a function of the date. Whenever every input pins down exactly one output, mathematicians reach for the phrase 'y is a function of x' — and write y = f(x), read 'f of x', for the output the rule assigns to x."],
          ["Four costumes, one rule","The squaring rule can be worn four ways: the formula f(x) = x², a table of pairs, the parabola you can draw, and the sentence 'multiply a number by itself'. Real fluency is changing costume without changing the rule — given any one, you can produce the other three."],
          ["Example — a function from a table","The campus café sells cocoa in 8-, 12-, and 16-ounce cups for $1.60, $2.40, and $3.20. Write p(s) for the price of size s: then p(12) = $2.40, the domain is the finite set {8, 12, 16} — those are the only sizes that exist — and the range is {1.60, 2.40, 3.20}. A domain does not have to be an interval; it is whatever inputs the situation actually allows."],
          ["Example — reading a graph","The quad's temperature above freezing one winter day is a curve T(t). The point (12, 4) on it says T(12) = 4°: noon was four degrees above freezing. At t = 18 the curve dips about one degree below the axis, so T(18) ≈ −1°. The curve spans t = 0 to 24 and sweeps heights −6° to 8° — so domain [0, 24], range [−6, 8]. Every question about the day is a question about the picture."],
          ["Example — a function from data","The campus app logged downloads by week after launch: 2, 5, 9, 14, 11, 8 hundred in weeks one through six. No formula produced these numbers, yet D is still a function — the table IS the rule. Plot the six points, sketch a smooth curve through them, and the curve estimates what the table doesn't say: reading between the points, week four's peak and the slide after it become visible at a glance."],
          ["Example — building a formula","The quad's cedar planters are open-top boxes twice as long as they are wide, holding 4 m³ of soil. Base cedar costs $8/m², side cedar $6/m². With width w: the base is w · 2w, the four sides are two of area wh and two of area 2wh, so C = 8(2w²) + 6(6wh) = 16w² + 36wh. Volume forces w · 2w · h = 4, so h = 2/w², and C(w) = 16w² + 72/w. Two variables collapsed to one — the constraint did it. Chapter 4 will optimize exactly this kind of formula."],
          ["Evaluating with letters","With f(x) = 3x² − 2x, feeding in numbers is routine: f(−2) = 12 + 4 = 16. But the rule also eats expressions: f(a) = 3a² − 2a, and f(1 + h) = 3(1 + h)² − 2(1 + h) = 3h² + 4h + 1. That last move — evaluating at 1 + h and simplifying — looks like a party trick today. In three weeks it is the beating heart of the derivative."],
          ["The graph is the rule, drawn","Plot every (input, output) pair and you get the graph. That's why the vertical line test works: a vertical line is a single input, and if it meets the curve twice, that input has two outputs — the machine is broken. A scatter plot with two points stacked vertically fails; a curve with a gap over some x passes — a vertical line missing the graph entirely is allowed."],
          ["Domain: where the rule makes sense","√x refuses negative numbers; 1/x refuses zero. So B(r) = √(r + 3) demands r ≥ −3, and g(x) = x/(x² − x) breaks at x = 0 and x = 1 — everywhere else both rules are happy. The domain is simply the set of inputs the formula tolerates — and on a graph, it's the shadow the curve casts on the x-axis."],
          ["Writing the answer like a mathematician","Domains get written in interval notation, and graders insist: x ≥ −3 is [−3, ∞), with the square bracket meaning −3 itself belongs; x > 0 is (0, ∞), the round bracket excluding the endpoint; and 'everything except 1' is (−∞, 1) ∪ (1, ∞), two pieces glued with the union symbol. Infinity always gets a round bracket — it is a direction, not a number you can reach. Same facts as the inequalities, in the notation every test expects."],
          ["Functions in pieces","One function may need two formulas: the café's delivery fee is f(x) = 5 for orders under $20 and f(x) = 0 from $20 up — one rule, two clauses. Written mathematically: f(x) = x + 5 when x < 0, and f(x) = x² when x ≥ 0. To evaluate, let the INPUT choose the branch: f(−2) uses the first clause (−2 < 0), giving 3; f(3) uses the second, giving 9. The absolute value is secretly this: |x| is −x for negatives and x from zero up — the most famous piecewise function in mathematics, and every exam's favourite."],
          ["Mathematical models","A model is a function standing in for a piece of the world — demand for a product, CO₂ in the air, coffee going cold. The cycle is always: formulate a function from data or principle, compute with it, interpret the answer back in the world, then test it against fresh reality — and when reality disagrees, refine the model and go around again. Every remaining week of this course lives somewhere on that loop."] ],
        viz:{ kind:"vline", note:"Drag the vertical line across two curves — a parabola that always passes the test, and a sideways one that fails it where the line meets it twice." },
        worked:{ prompt:"g(x) = √(x − 2). Evaluate g(6), then find the domain.",
          steps:[
            ["What does g do to an input?","Subtract 2, then take the square root — read the formula inside-out."],
            ["Feed it 6.","g(6) = √(6 − 2) = √4 = 2."],
            ["Which inputs does the rule tolerate?","The square root needs x − 2 ≥ 0, so x ≥ 2. The domain is every number from 2 upward."] ] },
        turn:[
          { q:"With h(x) = x² − 5x, evaluate h(3).", type:"num", ans:-6, tol:0,
            hint:"Square first, then subtract: 9 minus 15.",
            work:"h(3) = 9 − 15 = −6. Negative outputs are outputs too." },
          { q:"The domain of f(x) = 1/(x − 4) is every real number except…", type:"num", ans:4, tol:0,
            hint:"A fraction only breaks when its denominator is zero.",
            work:"x − 4 = 0 at x = 4; everywhere else the rule is happy." } ],
        homework:{ title:"Homework 1.1 — three attempts, parameters reshuffle each try", gen:[
          () => { const a = 2 + Math.floor(Math.random()*4), b = 1 + Math.floor(Math.random()*5);
            return { q:`f(x) = ${a}x + ${b}. Evaluate f(3).`, ans: a*3 + b, tol: 0 }; },
          () => { const c = 1 + Math.floor(Math.random()*6);
            return { q:`g(x) = x² − ${c}. For which positive x is g(x) = 0? (round to 2 decimals)`, ans: Math.sqrt(c), tol: 0.02 }; },
          () => { const d = 2 + Math.floor(Math.random()*7);
            return { q:`The domain of y = √(x − ${d}) starts at x = …`, ans: d, tol: 0 }; } ] } },
      qs:[
        { q:"If f(x) = x² − 3x, then f(4) equals…", opts:["2","4","8","28"], a:1, why:"16 − 12 = 4." },
        { q:"A curve in the plane is the graph of a function exactly when…", opts:["every vertical line meets it at most once","every horizontal line meets it at most once","it passes through the origin","it has no breaks"], a:0, why:"One input, one output — the vertical line test." } ] },
    { n:"1.2", t:"Combining and Transforming Functions",
      brief:"New functions are built from old ones: add them, multiply them, or feed one into another. Shifts and stretches move a known graph around the plane without re-deriving it.",
      key:"y = f(x − h) + k is the graph of f slid right by h and up by k.",
      full:{
        professor:"Today we stop treating every function as a stranger. Most of the graphs you will ever need are one familiar shape — moved, flipped, or stretched. Learn the parent shapes and the four moves, and a formula you have never seen becomes a picture you already know.",
        objectives:[
          "Form sums, products, and compositions of two functions.",
          "Predict how h and k in y = f(x − h) + k move a known graph.",
          "Decompose a complicated function into an outer and inner part." ],
        lecture:[
          ["Arithmetic on whole functions","Functions add, subtract and multiply pointwise: (f + g)(x) is just f(x) + g(x). The only care is the domain: a combination only makes sense where BOTH ingredients do, so the new domain is the overlap of the old two — and for a quotient f/g, strike out every x where g(x) = 0 besides. With f(x) = √x (domain x ≥ 0) and g(x) = x − 5 (domain everywhere), f · g lives on x ≥ 0 but f/g on x ≥ 0 with x = 5 removed."],
          ["Composition: one machine feeds another","f(g(x)) runs the inside machine first and pipes its output into the outside one. Order matters: squaring then adding 3 is not adding 3 then squaring. Half of Chapter 3's chain rule is simply learning to SEE the inside function."],
          ["Example — tracing a composition","Let f(x) = x² and g(x) = x − 3, and set h(x) = f(g(x)), k(x) = g(f(x)). Trace the input 5 through h: the inner machine gives g(5) = 2, and feeding 2 to f gives f(2) = 4 — so h(5) = 4. Now the other order: f(5) = 25, then k(5) = g(25) = 22. Same parts, different plumbing, different answers."],
          ["The domain rides along","A composition's domain has two gates: x must be legal for the INNER machine, and the inner machine's OUTPUT must be legal for the outer one. For f(g(x)) with f(x) = √x and g(x) = x − 3, the root demands g(x) ≥ 0, so the domain is x ≥ 3 — written [3, ∞) — even though g alone accepts everything. Tests love this question precisely because the constraint hides one machine deep."],
          ["Example — a composition that means something","A campus survey drone climbs to A(t) = −3t² + 7t hundred meters t minutes after launch, and the air temperature at altitude x hundred meters is f(x) = 21 − 0.8x °C. Then h(t) = f(A(t)) reads: minutes in, temperature at the drone out — h(1) = f(4) = 17.8°. Expanding gives the direct formula h(t) = 21 − 0.8(−3t² + 7t) = 2.4t² − 5.6t + 21. And A(f(x))? The algebra computes, but feeding a temperature into a function that expects minutes is nonsense — composition has to respect units, not just parentheses."],
          ["Example — undressing a formula","Given L(t) = (5t + 2)³, find an inner and outer function. Read the recipe aloud: first compute 5t + 2, THEN cube. So g(t) = 5t + 2 inside, f(x) = x³ outside, and L = f(g(t)). Other splits exist — g(t) = 5t with f(x) = (x + 2)³ also works — but the cleanest cut is at the natural seam. This decomposing eye is exactly what the chain rule will demand."],
          ["The four moves","Adding outside slides the graph up. Adding inside slides it left — inside changes are always backwards: if g(x) = f(x + 3), then g(1) = f(4), so the point that lived at 4 now shows up at 1. Multiplying outside stretches vertically; a minus sign outside flips it over the x-axis. Every move leaves the shape recognisable."],
          ["The mirror moves","Two more: y = f(2x) squeezes the graph toward the y-axis (g(1) = f(2) — what lived at 2 now sits at 1), while f(x/2) stretches it wide. And y = f(−x) mirrors the picture across the y-axis, the horizontal cousin of the upside-down flip. Inside changes act horizontally and backwards; outside changes act vertically and plainly — that one sentence organizes all eight moves."],
          ["Example — sketching in stages","To draw y = (x + 2)² − 3: start at the parent parabola, slide it left 2, then down 3 — vertex lands at (−2, −3). To draw y = −½x² + 4: compress the parent to half height, flip it into a hill, lift it 4. Never plot points one at a time when the shape is a parent in costume."],
          ["Example — transformations you can price","The bookstore charges C(x) thousand dollars for x hundred textbooks. A rival charging f(x) = C(x) + 9 is $9,000 dearer on every order — an upward shift. One charging g(x) = 1.25 C(x) runs 25% over — a vertical stretch. And h(x) = C(x − 2) matches the first store's price for an order two hundred books smaller — the graph slid right. Transformations aren't just geometry; each one is a sentence about the world."],
          ["Why this matters here","Applied models are dressed-up parents: a profit parabola is x² shifted and flipped; a cooling curve is a decaying exponential slid up to room temperature. Undressing the formula is usually the whole insight."] ],
        viz:{ kind:"transform", note:"Slide the vertex: the grey parent y = x² stays put while y = (x − h)² + k moves right and up with the slider." },
        worked:{ prompt:"Describe y = −(x − 3)² + 5 as moves on the parent y = x².",
          steps:[
            ["Read the inside first.","x − 3 inside slides the parabola right 3 — inside moves are backwards, so minus three means toward positive x."],
            ["Read the outside sign.","The leading minus flips it upside down: a hill, not a cup."],
            ["Read the constant.","+5 outside lifts the whole hill 5. Vertex: (3, 5), opening downward — a maximum at 5."] ] },
        turn:[
          { q:"With f(x) = x + 1 and g(x) = x², g(f(2)) equals…", type:"num", ans:9, tol:0,
            hint:"Inside machine first: f(2) = 3, then square it.",
            work:"f(2) = 3, and g(3) = 9. (f(g(2)) would have been 5 — order matters.)" },
          { q:"The graph of y = f(x + 4) is the graph of f shifted…", type:"mc",
            opts:["right 4","left 4","up 4","down 4"], a:1,
            hint:"Inside changes are backwards.",
            work:"To produce the old f(0), you now feed in x = −4 — the picture slides left." } ],
        homework:{ title:"Homework 1.2 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*4), b = 2 + Math.floor(Math.random()*3);
            return { q:`f(x) = x + ${a}, g(x) = x². Evaluate g(f(1)).`, ans: (1 + a) * (1 + a), tol: 0 }; },
          () => { const h = 1 + Math.floor(Math.random()*6);
            return { q:`The vertex of y = (x − ${h})² + 2 sits at x = …`, ans: h, tol: 0 }; },
          () => { const k = 1 + Math.floor(Math.random()*7);
            return { q:`y = x² + ${k} slides the parent parabola up by …`, ans: k, tol: 0 }; } ] } },
      qs:[
        { q:"With f(x) = x² and g(x) = x + 3, the composition f(g(x)) is…", opts:["x² + 3","(x + 3)²","x² + 9","x² + 6"], a:1, why:"g feeds into f: square the whole quantity x + 3." },
        { q:"The graph of y = f(x) + 2 is the graph of f…", opts:["shifted left 2","shifted up 2","stretched by 2","shifted right 2"], a:1, why:"Adding outside the function moves outputs — vertically." } ] },
    { n:"1.3", t:"Linear Models and Rates of Change",
      brief:"A process that changes by the same amount per unit is a line, and the slope is that amount. Most of applied calculus is noticing when a rate is constant — and when it only pretends to be.",
      key:"m = Δy / Δx: the change in output per one unit of input.",
      full:{
        professor:"The straight line is calculus's control group. It is the one graph whose rate of change never changes — which is exactly why, in a few weeks, we will describe every curve by the line that hugs it. Get fluent with slope now and the derivative will feel inevitable.",
        objectives:[
          "Compute the slope through two points and interpret its units.",
          "Write a line from a point and a slope, or from two points.",
          "Read fixed cost and marginal cost off a linear cost model." ],
        lecture:[
          ["Slope is a rate wearing geometry","Rise over run is dollars per unit, kilometres per hour, degrees per minute — whatever the axes carry. The number m answers one question: when the input grows by one, what does the output do?"],
          ["Same slope everywhere","Pick any two points of a line and Δy/Δx comes out identical. That is the line's defining privilege, and the failure of that privilege — curves — is what calculus was invented for."],
          ["Building the equation","With slope m through (x₁, y₁): y − y₁ = m(x − x₁) — any point (x, y) is on the line exactly when the slope from (x₁, y₁) to it equals m, which is all this equation says. Multiply out and you land on y = mx + b, where b is simply where the line greets the y-axis."],
          ["Example — a line through two points","Find the line through (−2, 5) and (4, −7). Slope first: m = (−7 − 5)/(4 − (−2)) = −12/6 = −2. Then point-slope with either point: y − 5 = −2(x + 2), which tidies to y = −2x + 1. Check with the point you didn't use: −2(4) + 1 = −7. ✓"],
          ["Parallel and perpendicular","Parallel lines never meet because they climb at the same rate: SAME slope, different intercepts. Perpendicular lines meet at a right angle, and their slopes multiply to −1 — each is the other's negative reciprocal. So everything parallel to y = 2x + 5 has slope 2, and everything perpendicular to it has slope −1/2. Two facts, asked on every line test ever written, and both are one sentence about slope."],
          ["Example — a model from a point and a rate","The chapel cistern fills at a steady 250 gallons per hour, and two hours after the pump starts it holds 900 gallons. Steady rate means linear: V − 900 = 250(t − 2), so V(t) = 250t + 400. The 400 is what the cistern held before the pump woke up — an intercept you never measured directly, recovered by the algebra."],
          ["Example — a line through data","Pembroke's enrollment since 2010 (call that t = 0) climbs roughly linearly: the scatter of yearly points hugs a line without sitting on one. Choose two well-separated, representative points — say (2, 1310) and (10, 1430): m = 120/8 = 15 students per year, giving E(t) = 15t + 1280. A different pair gives a slightly different line; the model isn't THE truth, it's a serviceable summary of the trend."],
          ["Interpolation and extrapolation","Using E(t) = 15t + 1280 inside the data — E(7) = 1385, an estimate for 2017 — is interpolation, and it's usually trustworthy. Pushing outside — E(20) = 1580 for 2030 — is extrapolation, a bet that the trend holds. And 'when does enrollment pass 1500?' solves to t = 14.67, but only whole years mean anything: E(14) = 1490 falls short and E(15) = 1505 clears it, so the model says 2025. Always hand a model's answer back to the world it came from."],
          ["Cost lines","C(x) = fixed + (per-unit)·x. The intercept is what you pay before making anything; the slope is what each additional unit costs. This little model returns in Chapter 3 with a new name: marginal cost."] ],
        viz:{ kind:"line", note:"The slider is the slope: watch one step right always produce m steps up, and the line tip from climbing through flat to falling." },
        worked:{ prompt:"Find the line through (2, 7) and (5, 16), and interpret its slope if x is chairs built and y is hours worked.",
          steps:[
            ["Slope first.","m = (16 − 7)/(5 − 2) = 9/3 = 3."],
            ["Point-slope form.","y − 7 = 3(x − 2), which tidies to y = 3x + 1."],
            ["Say it in chairs.","Each additional chair costs 3 hours; the 1 is an hour of setup nobody escapes."] ] },
        turn:[
          { q:"The slope of the line through (0, 4) and (6, 1) is… (2 decimals)", type:"num", ans:-0.5, tol:0.01,
            hint:"The y-values drop — the sign matters.",
            work:"(1 − 4)/(6 − 0) = −0.5: falling half a unit per step." },
          { q:"In C(x) = 120 + 8x, producing one more unit adds…", type:"num", ans:8, tol:0,
            hint:"Which number multiplies x?",
            work:"The slope 8 is the per-unit cost; 120 was spent before unit one." } ],
        homework:{ title:"Homework 1.3 — parameters reshuffle each attempt", gen:[
          () => { const m = 2 + Math.floor(Math.random()*4), x1 = 1 + Math.floor(Math.random()*3);
            return { q:`A line has slope ${m} and passes through (${x1}, 5). Its y-value at x = ${x1 + 2} is…`, ans: 5 + 2*m, tol: 0 }; },
          () => { const a = 1 + Math.floor(Math.random()*4), b = a + 2 + Math.floor(Math.random()*4);
            return { q:`Slope through (${a}, ${a*3}) and (${b}, ${b*3})?`, ans: 3, tol: 0 }; },
          () => { const f = 50 + 10*Math.floor(Math.random()*5), u = 3 + Math.floor(Math.random()*5);
            return { q:`C(x) = ${f} + ${u}x. Total cost of 10 units?`, ans: f + 10*u, tol: 0 }; } ] } },
      qs:[
        { q:"The slope of the line through (1, 5) and (3, 11) is…", opts:["2","3","6","8"], a:1, why:"Rise 6 over run 2." },
        { q:"A factory's cost is C(x) = 40 + 2.5x dollars for x units. The 2.5 means…", opts:["the cost of the first unit","the fixed cost","the extra cost of each additional unit","the average cost of all units"], a:2, why:"Slope is cost per additional unit; 40 is the fixed cost." } ] },
    { n:"1.4", t:"Polynomial Models and Power Functions",
      brief:"Powers of x are the alphabet of modelling: quadratics for curvature, cubics for turning points, and the highest power always wins in the long run.",
      key:"End behaviour is decided by the leading term alone.",
      full:{
        professor:"Polynomials are the workhorses of modelling because they can bend. A line commits to one direction forever; a quadratic can turn once, a cubic twice. Today is about reading a polynomial's silhouette straight off its formula — degree, leading sign, and where it lives long-term.",
        objectives:[
          "Identify a polynomial's degree and leading coefficient.",
          "Predict end behaviour from the leading term alone.",
          "Locate a quadratic's vertex and read its maximum or minimum." ],
        lecture:[
          ["What counts as a polynomial","P(x) = aₙxⁿ + … + a₁x + a₀: powers of x with constant coefficients, nothing else — no roots of x, no x in a denominator, no x upstairs in an exponent. The largest power n is the degree, and every polynomial's domain is all real numbers: there is nothing a sum of powers refuses to eat."],
          ["Degree counts the turns","A degree-n polynomial turns at most n − 1 times. That is why quadratics model single-peak stories — one price with maximum revenue — and cubics model rise-fall-rise."],
          ["Example — graphing a quadratic by hand","g(x) = −3(x + 1)² + 5 is the parent parabola stretched to triple height, flipped into a hill, slid left 1 and up 5: vertex (−1, 5), the highest point on the graph. Every quadratic ax² + bx + c can be regrouped into this a(x − h)² + k form — which is why every quadratic is one parabola in costume, and why the vertex is always findable without plotting a single point."],
          ["Example — reading increase and decrease","A cubic's graph climbs to a hilltop at (−1, 30), descends to a valley floor at (2, 3), then climbs for good. Say it in input language: increasing on (−∞, −1), decreasing on (−1, 2), increasing on (2, ∞). The description names x-intervals, never y — WHERE the function rises, not how high it gets. Chapter 4 will find those turning points from the formula; today we read them off the picture."],
          ["The long run belongs to the leader","Far from the origin, the highest power dwarfs every other term. x³ − 100x² is enormous and positive for big x, never mind the −100x². End behaviour: read the leading term, ignore the rest."],
          ["Even vs odd degree","Even-degree leaders exit the picture on the same side (both arms up, or both down); odd-degree leaders exit on opposite sides. One glance at the degree's parity tells you the silhouette."],
          ["Power functions — fractional and negative","f(x) = xᵃ doesn't stop at whole powers. x^(1/2) is the square root, climbing ever slower; x^(−1) is 1/x, hugging both axes as asymptotes. Even n gives the parabola's U-family; odd n the cubic's S-family. These few shapes are the vocabulary every applied model draws on."],
          ["Example — output that scales by a fractional power","In 1928 the economists Cobb and Douglas found national production tracking a fractional power of capital invested. A campus-sized version: suppose a print shop's output is P(x) = 45x^(1/4) for capital x. Raising capital 50%, from 100 to 150, multiplies output by 1.5^(1/4) ≈ 1.107 — about 10.7% more, and the coefficient 45 never mattered. Fractional powers mean diminishing returns: more input always helps, each unit less than the last."],
          ["Example — rational functions and average cost","Divide one polynomial by another and you get a rational function, defined wherever the denominator isn't zero. The flagship: a toy line costs C(x) = 0.5x² + 8x + 640 dollars for x units, so the average cost per unit is a(x) = C(x)/x = 0.5x + 8 + 640/x. Small runs are brutal — a(10) = $77 each — because the 640 of fixed cost is spread over ten toys; at x = 80, a(80) = $56. Watching which term dominates at each scale is the whole art."],
          ["Direct and inverse variation","'y varies directly with x' means y = kx; 'inversely' means y = k/x. Find k from one measurement, then the model answers everything: if brightness varies inversely with distance squared and B(5) = 180, then k = 180 · 25 = 4500, so B(10) = 45 — double the distance, a quarter of the light."],
          ["The vertex, without calculus — for now","y = ax² + bx + c turns at x = −b/(2a). In Chapter 4 the derivative will re-derive this in one line — remember today's formula so you can appreciate that one."] ],
        viz:{ kind:"transform", note:"The parent parabola again — because every quadratic is this shape, slid to its vertex. Slide it and imagine the model: the vertex is the maximum profit, the best price, the highest point of the arch." },
        worked:{ prompt:"R(x) = −2x² + 36x models revenue. Where does it peak, and how high?",
          steps:[
            ["Which x turns the parabola?","x = −b/(2a) = −36/(2·(−2)) = 9."],
            ["How high is the peak?","R(9) = −162 + 324 = 162."],
            ["Sanity: why a peak, not a valley?","a = −2 is negative — the parabola opens downward, so the turn is a maximum. Nine units, revenue 162."] ] },
        turn:[
          { q:"The degree of p(x) = (x² + 1)(x⁴ − x) is…", type:"num", ans:6, tol:0,
            hint:"Degrees add when you multiply.",
            work:"2 + 4 = 6 — no need to expand anything else." },
          { q:"As x → −∞, y = x³ heads…", type:"mc",
            opts:["up","down","toward zero","toward 3"], a:1,
            hint:"Cube a huge negative number.",
            work:"Odd degree, positive leader: down on the left, up on the right." } ],
        homework:{ title:"Homework 1.4 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*3), b = 2*a*(2 + Math.floor(Math.random()*4));
            return { q:`y = −${a}x² + ${b}x peaks at x = …`, ans: b/(2*a), tol: 0 }; },
          () => { const n = 2 + Math.floor(Math.random()*3), k = 1 + Math.floor(Math.random()*3);
            return { q:`Degree of (x${["²","³","⁴"][n-2]} − 1)(x${["","²","³"][k-1] || ""} + 2)?`, ans: n + k, tol: 0 }; },
          () => { const c = 2 + Math.floor(Math.random()*5);
            return { q:`p(x) = x² − ${c*c}. Its positive root is x = …`, ans: c, tol: 0 }; } ] } },
      qs:[
        { q:"The degree of (x² + 1)(x³ − 2) is…", opts:["2","3","5","6"], a:2, why:"Degrees add under multiplication: 2 + 3." },
        { q:"As x grows large, which grows fastest?", opts:["x²","x³","√x","10x"], a:1, why:"A higher power outruns any multiple of a lower one." } ] },
    { n:"1.5", t:"Exponential Models",
      brief:"When a quantity grows by the same percentage each step, it is exponential: multiply, don't add. Doubling times and compound interest both live here.",
      key:"P(t) = P₀ · bᵗ grows when b is above 1 and decays when b is between 0 and 1.",
      full:{
        professor:"Linear growth adds; exponential growth multiplies. That single difference separates salaries from epidemics, and simple interest from compound. Today you learn to recognise multiplication-in-disguise — and to meet e, the one base whose curve's steepness equals its height.",
        objectives:[
          "Model repeated percentage change as P₀ · bᵗ.",
          "Convert between growth rate, growth factor, and doubling time.",
          "Explain what makes the base e special." ],
        lecture:[
          ["Adding versus multiplying","Save 100 a month and wealth climbs a staircase. Grow 5% a month and wealth rides a curve that starts lazy and ends vertical. Same-looking early numbers, utterly different destinies — check whether the CHANGE is fixed or proportional."],
          ["The family portrait","Every curve y = aˣ passes through (0, 1) — anything to the zeroth power is 1 — and never touches the x-axis. Bigger bases climb faster on the right; a base between 0 and 1 falls instead of climbs. And since (1/a)ˣ = a^(−x), the decaying curve is exactly the growing one mirrored across the y-axis: one family, viewed from two sides."],
          ["Example — sketching relatives","y = 3 · 2ˣ is the doubling curve stretched to triple height — it crosses the y-axis at 3 instead of 1, domain all reals, range y > 0. y = 2ˣ − 4 slides the curve down 4: now it crosses zero (at x = 2) and its long left tail hugs the line y = −4 instead of the axis. Transformations from 1.2 apply to exponentials unchanged."],
          ["Factor and rate","Growing 5% means multiplying by 1.05; losing 20% means multiplying by 0.8. The factor b carries everything: above 1 grows, below 1 decays, and t of them compound as bᵗ."],
          ["The exponent laws still run the show","aˣ⁺ʸ = aˣ·aʸ, (aˣ)ʸ = aˣʸ, a⁻ˣ = 1/aˣ. They collapse expressions that look unrelated: 2^(3+2t) is 8 · 4ᵗ in one move, since 2^(3+2t) = 2³ · (2²)ᵗ. Recognising the same exponential under two spellings is half of solving the equations in 1.6."],
          ["Doubling time","If a quantity doubles every T units, it is P₀ · 2^(t/T). Three doublings is ×8 regardless of what is doubling — bacteria, debt, or transistor counts."],
          ["Example — fitting an exponential to data","Devices on the dorm Wi-Fi by year: 210, 280, 370, 490, 650. Check the ratios: each year is ≈ 1.32 times the last — a steady FACTOR, not a steady difference, so the model is exponential: D(t) ≈ 210 · (1.32)ᵗ. (A calculator's exponential regression automates the ratio-checking, but the diagnosis — constant percent change — is yours to make.) Plot model over data before trusting it; a curve that misses the points is a hypothesis, not a fit."],
          ["Why e","Zoom in at (0, 1): the doubling curve y = 2ˣ crosses with slope about 0.69, while y = 3ˣ crosses at about 1.10. Somewhere between 2 and 3 lives the one base whose curve crosses with slope exactly 1 — and that base, e ≈ 2.718, turns out to have slope equal to its height at EVERY point. That self-referential property is why e owns Chapter 3: its derivative is itself."] ],
        viz:{ kind:"explog", note:"The slider is the base b: sweep it from decay (b below 1) through frozen (b = 1) into growth, and notice every curve pivots through (0, 1)." },
        worked:{ prompt:"A colony of 500 grows 8% per hour. Model it and give the size after 3 hours.",
          steps:[
            ["Choose the factor.","8% growth is ×1.08 each hour."],
            ["Write the model.","P(t) = 500 · 1.08ᵗ."],
            ["Run three hours.","500 · 1.08³ ≈ 500 · 1.2597 ≈ 630 individuals."] ] },
        turn:[
          { q:"A 6% annual raise multiplies salary each year by…", type:"num", ans:1.06, tol:0.001,
            hint:"Rate to factor: add it to 1.",
            work:"×1.06 — after two years it is ×1.06², not ×1.12: compounding." },
          { q:"P(t) = 200 · 2^(t/5): the population at t = 15 is…", type:"num", ans:1600, tol:0,
            hint:"How many doublings fit in 15?",
            work:"Three doublings: 200 → 400 → 800 → 1600." } ],
        homework:{ title:"Homework 1.5 — parameters reshuffle each attempt", gen:[
          () => { const p = 100*(2 + Math.floor(Math.random()*4)), d = 2 + Math.floor(Math.random()*3);
            return { q:`P(t) = ${p} · 2^(t/${d}). Evaluate P(${2*d}).`, ans: p*4, tol: 0 }; },
          () => { const r = 5 + Math.floor(Math.random()*15);
            return { q:`Losing ${r}% per year multiplies each year by … (2 decimals)`, ans: +(1 - r/100).toFixed(2), tol: 0.001 }; },
          () => { const b = [2,3,4][Math.floor(Math.random()*3)], n = 2 + Math.floor(Math.random()*2);
            return { q:`Simplify: ${b}${n === 2 ? "²" : "³"} · ${b} = ${b} to what power?`, ans: n + 1, tol: 0 }; } ] } },
      qs:[
        { q:"A culture follows P(t) = 100 · 2^(t/3). At t = 9 it holds…", opts:["300","600","800","900"], a:2, why:"Three doublings: 100 → 200 → 400 → 800." },
        { q:"P(t) = P₀ · bᵗ models decay exactly when…", opts:["b is negative","b is between 0 and 1","b equals 1","b is above 1"], a:1, why:"A fraction of itself each step shrinks it." } ] },
    { n:"1.6", t:"Logarithmic Models",
      brief:"The logarithm answers the exponential's question in reverse: to what power must the base be raised to reach this number? It turns multiplication into addition, which is why it tames growth.",
      key:"ln(eˣ) = x, and log(ab) = log a + log b.",
      full:{
        professor:"Every exponential question has a partner asked backwards. 'What is 2⁵?' has the partner '2 to what power is 32?' — and the logarithm is simply the machine that answers the backwards version. Master that one sentence and every log rule becomes obvious.",
        objectives:[
          "Translate between exponential and logarithmic statements.",
          "Use the log rules to expand and collapse expressions.",
          "Solve exponential equations exactly with ln." ],
        lecture:[
          ["The question a dish of bacteria asks","A culture doubling hourly from 1000 follows N = 2ᵗ thousand. The forward question — 'how many at t = 3?' — is exponential: 8000. But the lab actually asks the reverse: 'WHEN does the dish hit 8000?' The answer machine for that question is the logarithm: log₂ 8 = 3. Every exponential function has this shadow function reading its table backwards."],
          ["The backwards question","log₂ 32 asks: 2 to what power gives 32? Answer 5. Writing y = logₐx and x = aʸ is saying the same fact in two dialects — practise switching until it is reflex."],
          ["Example — evaluating logs cold","log₃ 81 = 4, because 3⁴ = 81. log₅(1/25) = −2, because 5⁻² = 1/25. ln e⁷ = 7 — ln IS log base e, so it reads exponents of e directly. And logₐ1 = 0 for every base, because a⁰ = 1. None of these needed a calculator; all of them needed the backwards sentence."],
          ["The mirror picture","Because the log undoes the exponential, its graph is the exponential's reflection across the line y = x. Every point (a, 2ᵃ) on one curve has its twin (2ᵃ, a) on the other. The exponential's range y > 0 becomes the log's domain x > 0: you can only un-exponentiate a positive number."],
          ["Example — sketching a log by transformation","y = ln(x − 2) − 1 is the parent ln x slid right 2 and down 1. The slide drags the vertical asymptote along: the wall at x = 0 now stands at x = 2, and the domain is x > 2. One point to anchor the sketch: at x = e + 2 the inside is e, so y = ln(e) − 1 = 0 — the curve crosses the axis just past x ≈ 4.7. The 1.2 toolkit never retired."],
          ["Multiplication becomes addition","log(ab) = log a + log b, and log(aⁿ) = n·log a. Logs flatten products into sums — the property that once powered slide rules and today pulls exponents down out of equations."],
          ["Example — a log equation","ln x = 4 looks abstract until you say it backwards: e⁴ = x. Done — x = e⁴ ≈ 54.6. Any equation with a lone log unwraps the same way: rewrite in exponential dialect and read off the answer."],
          ["Solving with ln","To solve 5 · e^(2t) = 40: isolate the exponential (e^(2t) = 8), take ln of both sides (2t = ln 8), divide. The exact answer keeps the ln; the calculator step comes last, if at all."],
          ["Example — the full routine","Solve e^(2−3x) = 12. Take ln of both sides: 2 − 3x = ln 12. Solve linearly: x = (2 − ln 12)/3 ≈ −0.1617. Two moves — ln strips the e, algebra finishes — and they are the same two moves for every exponential equation you will ever meet, including every half-life and doubling-time question in Chapter 3."] ],
        viz:{ kind:"loginv", note:"Slide a point along y = 2ˣ and watch its mirror twin move along y = log₂x — the dashed line y = x is the mirror." },
        worked:{ prompt:"Solve 3 · e^(2t) = 24 exactly.",
          steps:[
            ["Isolate the exponential.","e^(2t) = 8 — divide both sides by 3 before touching any logarithm."],
            ["Undo e with ln.","2t = ln 8."],
            ["Finish.","t = (ln 8)/2 ≈ 1.04 — but (ln 8)/2 is the exact answer, and 'exact' is the habit this course rewards."] ] },
        turn:[
          { q:"log₃ 81 equals…", type:"num", ans:4, tol:0,
            hint:"3 to what power reaches 81?",
            work:"3⁴ = 81, so the backwards question answers 4." },
          { q:"ln(a·b) always equals…", type:"mc",
            opts:["ln a · ln b","ln a + ln b","ln a − ln b","ln(a + b)"], a:1,
            hint:"Logs turn products into…",
            work:"Products become sums — the log's defining trick." } ],
        homework:{ title:"Homework 1.6 — parameters reshuffle each attempt", gen:[
          () => { const b = [2,3,5][Math.floor(Math.random()*3)], n = 2 + Math.floor(Math.random()*3);
            return { q:`log base ${b} of ${Math.pow(b, n)} = …`, ans: n, tol: 0 }; },
          () => { const k = 2 + Math.floor(Math.random()*4);
            return { q:`Solve eˣ = ${k} for x. (2 decimals)`, ans: +Math.log(k).toFixed(2), tol: 0.02 }; },
          () => { const n = 2 + Math.floor(Math.random()*5);
            return { q:`ln(e${n === 2 ? "²" : n === 3 ? "³" : "^" + n}) = …`, ans: n, tol: 0 }; } ] } },
      qs:[
        { q:"log₂ 32 equals…", opts:["4","5","6","16"], a:1, why:"2⁵ = 32." },
        { q:"The exact solution of eˣ = 10 is x =…", opts:["10/e","e/10","ln 10","log₂ 10"], a:2, why:"The natural log undoes eˣ." } ] } ] },
  { title:"Unit II · Limits & the Derivative", sections:[
    { n:"2.1", t:"Measuring Change",
      brief:"Before the derivative there is the average rate: total change divided by the interval it took. Geometrically it is the slope of a secant line — honest, but blurred across the whole interval.",
      key:"Average rate on [a, b] = (f(b) − f(a)) / (b − a).",
      full:{
        professor:"Chapter 2 begins the course's real question: how fast is a thing changing right now? We cannot answer 'right now' yet — but we can answer 'on average over this stretch', and today's honest, slightly blurry number is the raw material the derivative will be built from.",
        objectives:[
          "Compute an average rate of change over an interval with correct units.",
          "See the average rate as a secant line's slope.",
          "Explain why shrinking the interval sharpens the estimate." ],
        lecture:[
          ["The odometer argument","Drive 150 km in 2 hours and your average speed is 75 km/h — total change over elapsed time, no cleverness required. For any function: average rate on [a, b] is (f(b) − f(a))/(b − a)."],
          ["Increments get names","When x moves from x₁ to x₂, the change Δx = x₂ − x₁ is called an increment, and the output responds with Δy = f(x₂) − f(x₁). The average rate is Δy/Δx — Chapter 1's slope formula wearing calculus's favourite notation. The Δ's will shrink all chapter; learn to read them now."],
          ["Example — an average rate from a formula","g(t) = t² + 2t litres in a vat, t in minutes. On [1, 4]: g(1) = 3 and g(4) = 24, so the average fill rate is (24 − 3)/(4 − 1) = 7 litres per minute. Three lines of arithmetic — but say the units aloud every time, because 7 without 'litres per minute' is not an answer."],
          ["The picture is a secant","Mark (a, f(a)) and (b, f(b)) on the graph and connect them. That chord's slope IS the average rate — the same rise-over-run from Chapter 1, now cutting across a curve instead of lying along a line."],
          ["Example — an average rate from a graph alone","The campus shuttle's fuel-economy curve slopes down at speed: reading the graph, roughly (30, 27) and (50, 21) — miles per gallon at miles per hour. Secant slope: (21 − 27)/(50 − 30) = −0.3. Units: mpg per mph, and the sign matters — economy FALLS three-tenths of a mile-per-gallon for each extra mile-per-hour across that range. No formula existed; the graph was enough."],
          ["Example — the problem of the instant","Drop a keyring from Drosdick Hall's roof: Galileo says it falls s(t) = 4.9t² metres in t seconds. Its average speed on [2, 2.1] is 4.9(2.1² − 2²)/0.1 = 20.09 m/s; on [2, 2.01], 19.649; on [2, 2.001], 19.6049. But 'how fast at EXACTLY t = 2?' names a single instant — no interval, no Δt to divide by, and division by zero is nonsense. The averages are clearly closing in on 19.6. What exactly they are closing in on — and why that's legitimate — is the next two lectures."],
          ["Blur and how to reduce it","An average over two hours hides every burst and every stop inside it. Average over a shorter stretch and less can hide; the estimate hugs the moment more closely. Follow that instinct to its limit and you arrive at 2.3."],
          ["Units discipline","Output units per input unit, always: dollars per unit, metres per second, people per year. If your rate's units are wrong, the number is wrong, however pretty the arithmetic."] ],
        viz:{ kind:"secant", tangent:false, note:"The secant as an honest average: slide the second point closer and watch the average rate settle down as the interval shrinks." },
        worked:{ prompt:"f(t) = t³ gives litres in a tank after t minutes. Average fill rate from t = 1 to t = 3?",
          steps:[
            ["Total change first.","f(3) − f(1) = 27 − 1 = 26 litres."],
            ["Over elapsed time.","26 litres over 2 minutes."],
            ["The rate, with units.","13 litres per minute — the slope of the chord from (1, 1) to (3, 27)."] ] },
        turn:[
          { q:"f(x) = x² + 1: the average rate of change on [2, 5] is…", type:"num", ans:7, tol:0,
            hint:"(f(5) − f(2)) over (5 − 2).",
            work:"(26 − 5)/3 = 7 — and notice 7 sits between f′(2) = 4 and f′(5) = 10, foreshadowing." },
          { q:"Shrinking the interval [a, b] toward a point makes the average rate approach…", type:"mc",
            opts:["zero","the instantaneous rate","the y-intercept","the average of f"], a:1,
            hint:"Less room for the function to hide bursts and stops.",
            work:"The secant closes onto the tangent — next lecture makes this the definition of the derivative." } ],
        homework:{ title:"Homework 2.1 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*3), b = a + 2;
            return { q:`f(x) = x². Average rate of change on [${a}, ${b}]?`, ans: a + b, tol: 0 }; },
          () => { const d = 60 + 30*Math.floor(Math.random()*4), t = 2 + Math.floor(Math.random()*2);
            return { q:`${d} km in ${t} hours: average speed in km/h?`, ans: d/t, tol: 0.01 }; },
          () => { const c = 2 + Math.floor(Math.random()*4);
            return { q:`f(x) = ${c}x + 1. Average rate of change on any interval?`, ans: c, tol: 0 }; } ] } },
      qs:[
        { q:"The average rate of change of f(x) = x² on [1, 3] is…", opts:["2","4","5","8"], a:1, why:"(9 − 1)/(3 − 1) = 4." },
        { q:"Average velocity is to instantaneous velocity as…", opts:["a tangent line is to a secant line","a secant line is to a tangent line","a curve is to a line","a limit is to a sum"], a:1, why:"Average = secant slope; instantaneous = tangent slope." } ] },
    { n:"2.2", t:"Limits",
      brief:"A limit is the value a function is heading toward — which may exist even where the function itself is undefined. Factor, cancel, and the hole often reveals its value.",
      key:"lim (x → 2) of (x² − 4)/(x − 2) = 4: the graph has a hole, the approach has an answer.",
      full:{
        professor:"The limit is calculus's one genuinely new idea — everything else is consequences. It answers a strange-sounding question: not 'what is f at this point?' but 'what is f becoming as we approach it?' Those can differ, and the difference is where derivatives live.",
        objectives:[
          "Evaluate limits numerically, graphically, and by algebra.",
          "Resolve 0/0 forms by factoring and cancelling.",
          "Decide when a limit fails to exist using one-sided limits." ],
        lecture:[
          ["Approaching is not arriving","(x² − 4)/(x − 2) is undefined at x = 2 — plug it in and you get the meaningless 0/0. But feed it 1.9, 1.99, 2.01… and the outputs march obediently toward 4. The function never arrives; its values commit to a destination anyway. That destination is the limit, written lim (x → 2) f(x) = 4, read 'f(x) approaches 4 as x approaches 2'."],
          ["Example — a limit by table first","Chase lim (x → 1) of (x − 1)/(x² − 1) numerically: at x = 0.9, 0.99, 1.01, 1.1 the outputs read 0.526, 0.5025, 0.4975, 0.476 — closing on 0.5 from both flanks. The table is evidence, not proof: tables can be fooled by slow drift. But it tells you what answer the algebra should defend."],
          ["The limit laws","Limits respect arithmetic: the limit of a sum is the sum of the limits, ditto products, quotients (denominator limit nonzero), and constant multiples. So lim (x → 4) of (3x² − 5x + 2) splits into 3·(lim x)² − 5·(lim x) + 2 = 48 − 20 + 2 = 30 — which is exactly f(4). For polynomials the laws always cascade down to plain substitution; that is WHY polite functions are polite."],
          ["Algebra clears the fog","Factor: (x − 2)(x + 2)/(x − 2). For every x except 2 this IS x + 2 — and cancelling is legal precisely because the limit never considers x = 2 itself, only neighbours, where x − 2 ≠ 0. So approaching 2 it approaches 4. The cancelled factor was the removable hole; the algebra proves what the table only suggested."],
          ["Example — continuity does the deciding","f(x) = (x − 1)/(x² − 1) has domain everything except ±1. At x = 4 — inside the domain — substitution is justified: f(4) = 3/15 = 0.2, no drama. At x = 1 — outside — substitute and you get 0/0, so work instead: factor x² − 1 = (x − 1)(x + 1), cancel, and (x − 1)/(x² − 1) becomes 1/(x + 1), whose limit at 1 is 1/2. One function, two points, two entirely different amounts of work — the domain told you which."],
          ["Example — rationalizing","lim (h → 0) of (√(9 + h) − 3)/h is 0/0 with nothing to factor. Multiply top and bottom by the conjugate √(9 + h) + 3: the numerator collapses to (9 + h) − 9 = h, the h's cancel, and you're left with 1/(√(9 + h) + 3) → 1/6. The conjugate trick is the square root's version of factoring — and it reappears verbatim inside derivative computations."],
          ["Two sides must agree","Limits are approached from the left and from the right. If the two approaches disagree — a step function at its jump — there is no single destination and the two-sided limit does not exist."],
          ["Most functions are polite","For polynomials and other continuous functions, the limit is just the value: approaching and arriving agree. The interesting cases — the ones this chapter exists for — are precisely where they don't."] ],
        viz:{ kind:"limithole", note:"Two blue scouts approach x = 2 from both sides along the curve; their heights close in on 4, the hole's altitude — the value f itself refuses to have." },
        worked:{ prompt:"Evaluate lim (x → 3) of (x² − 9)/(x − 3).",
          steps:[
            ["Try substitution first.","(9 − 9)/(3 − 3) = 0/0 — no verdict. The 0/0 form is an invitation to work, not an answer."],
            ["Factor and cancel.","(x − 3)(x + 3)/(x − 3) = x + 3 for every x except 3."],
            ["Now approach.","As x → 3, x + 3 → 6. The limit is 6; the hole in the graph sits at (3, 6)."] ] },
        turn:[
          { q:"lim (x → 4) of (x² − 16)/(x − 4) equals…", type:"num", ans:8, tol:0,
            hint:"Factor the difference of squares first.",
            work:"(x − 4)(x + 4)/(x − 4) → x + 4 → 8." },
          { q:"If f approaches 3 from the left of a point and 5 from the right, the two-sided limit…", type:"mc",
            opts:["is 4","is 5","is 3","does not exist"], a:3,
            hint:"One destination required.",
            work:"The sides disagree, so there is no single value being approached — the limit does not exist." } ],
        homework:{ title:"Homework 2.2 — parameters reshuffle each attempt", gen:[
          () => { const a = 2 + Math.floor(Math.random()*5);
            return { q:`lim (x → ${a}) of (x² − ${a*a})/(x − ${a}) = …`, ans: 2*a, tol: 0 }; },
          () => { const c = 1 + Math.floor(Math.random()*5);
            return { q:`lim (x → 2) of (x² + ${c}) = …`, ans: 4 + c, tol: 0 }; },
          () => { const k = 2 + Math.floor(Math.random()*4);
            return { q:`lim (h → 0) of (${k}h + h²)/h = …`, ans: k, tol: 0 }; } ] } },
      qs:[
        { q:"lim (x → 3) of (x² − 9)/(x − 3) equals…", opts:["0","3","6","does not exist"], a:2, why:"Factor to x + 3, then let x → 3." },
        { q:"If the left-hand and right-hand limits at a point disagree, the two-sided limit…", opts:["is their average","is the larger one","does not exist","equals f at the point"], a:2, why:"A limit exists only when both sides agree." } ] },
    { n:"2.3", t:"Rates of Change and Derivatives",
      brief:"Shrink the secant's interval to nothing and its slope converges to the tangent's: that limit is the derivative, the instantaneous rate of change.",
      key:"f′(a) = lim (h → 0) of (f(a+h) − f(a)) / h.",
      full:{
        professor:"This is the lecture the course is named after. Everything before it built the stage; everything after it is consequences. Watch one number — the slope of a line through two points — turn into calculus as the two points become one.",
        objectives:[
          "Compute the slope of a secant line through P and a nearby point Q.",
          "Describe the tangent slope as the limit of secant slopes as Q slides into P.",
          "Interpret f′(a) as an instantaneous rate with real units." ],
        lecture:[
          ["Two points make a slope","Fix P on the curve and pick a neighbour Q. The line through them — the secant — has an honest, computable slope: rise over run. No calculus yet, just algebra with a good view."],
          ["Now slide Q home","Drag Q toward P and the secant swings, settling toward one particular line: the tangent. Its slope is the number the secant slopes were sneaking up on — a limit, and our first derivative."],
          ["Example — the keyring, settled","In 2.1 the falling keyring's average speeds on [2, t] crowded toward 19.6 without ever reaching it. Now finish the story: the average speed is 4.9(t² − 4)/(t − 2), which factors and cancels — 2.2's move — into 4.9(t + 2) for t ≠ 2. That simplified form is polite, so its limit at t = 2 is substitution: 4.9 · 4 = 19.6 m/s exactly. Yesterday's suggestive table is today's short proof; that is the whole shape of this chapter."],
          ["The h dialect","Instead of letting a second point x slide toward a, name the GAP h = x − a and let it shrink: f′(a) = lim (h → 0) of (f(a + h) − f(a))/h. Same limit, different bookkeeping — and usually cleaner algebra, because the difference quotient hands you an h to cancel. Both dialects appear on every calculus exam ever written; read them as one idea."],
          ["Example — a derivative by definition","f(x) = x² at a = 2: (f(2 + h) − f(2))/h = (4 + 4h + h² − 4)/h = 4 + h, so the limit as h → 0 is f′(2) = 4. Run it again at a general a and the same algebra gives 2a + h → 2a. One computation, every point of the parabola narrated — you have just met next lecture's main character."],
          ["Example — the tangent line itself","A slope alone isn't a line. For f(x) = x² at x = 3: the slope is f′(3) = 6 and the point is (3, 9), so point-slope gives y − 9 = 6(x − 3), or y = 6x − 9. Chapter 1's line-writing machinery, fed by calculus — this pairing is how every 'find the tangent line' problem in existence gets solved."],
          ["Zoom in and the curve is a line","Magnify any smooth curve enough at a point and it straightens into its tangent — which is why people say 'the slope of the CURVE at P'. Local straightness is the honest geometric meaning of differentiability, and it's why the tangent line is such a good stand-in for the function near the point."],
          ["Name it and use it","That limiting slope at x = a is written f′(a). On a position graph it is velocity right now; on a cost curve it is the cost of the very next unit. One geometric picture, every applied meaning in this course."] ],
        viz:{ kind:"secant", note:"Slide Q toward P on f(x) = x² at P = (1, 1) and watch the secant slope approach the tangent's slope, 2." },
        worked:{ prompt:"For f(x) = x², estimate the tangent slope at x = 1 using secants.",
          steps:[
            ["Slope of the secant from x = 1 to x = 1.5?","(2.25 − 1)/(0.5) = 2.5."],
            ["From x = 1 to x = 1.1?","(1.21 − 1)/(0.1) = 2.1."],
            ["From x = 1 to x = 1.01?","(1.0201 − 1)/(0.01) = 2.01 — the slopes are converging on 2. That limit is f′(1)."] ] },
        turn:[
          { q:"For f(x) = x², the secant slope from x = 2 to x = 3 is…", type:"num", ans:5, tol:0,
            hint:"(f(3) − f(2)) divided by (3 − 2).",
            work:"(9 − 4)/1 = 5 — and the tangent slope at 2 is 4, which the secants approach." },
          { q:"f′(a) is best described as the slope of the…", type:"mc",
            opts:["secant through any two points","tangent line at a","the y-axis","average of all slopes"], a:1,
            hint:"The limiting line, not the approximating one.",
            work:"Secants approximate; the tangent is their limit, and f′(a) is its slope." } ],
        homework:{ title:"Homework 2.3 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*4);
            return { q:`f(x) = x². The secant slope from x = ${a} to x = ${a+1} is…`, ans: 2*a + 1, tol: 0 }; },
          () => { const a = 1 + Math.floor(Math.random()*5);
            return { q:`f(x) = x². The tangent slope at x = ${a} (the limit the secants chase) is…`, ans: 2*a, tol: 0 }; },
          () => { const v = 10 + Math.floor(Math.random()*40);
            return { q:`A car's position graph has tangent slope ${v} km/h at t = 2. Its instantaneous speed then is … km/h.`, ans: v, tol: 0 }; } ] } },
      qs:[
        { q:"For f(x) = x², the derivative f′(3) is…", opts:["3","6","9","12"], a:1, why:"f′(x) = 2x, so f′(3) = 6." },
        { q:"If f measures litres and x measures minutes, f′ is measured in…", opts:["litres","minutes","litres per minute","minutes per litre"], a:2, why:"A derivative always carries output units per input unit." } ] },
    { n:"2.4", t:"The Derivative as a Function",
      brief:"Take the derivative at every point and you get a new function, f′, whose sign narrates the original: positive where f rises, zero where it pauses. Corners and jumps are where the narration fails.",
      key:"Differentiable implies continuous — but |x| shows the converse is false.",
      full:{
        professor:"Yesterday the derivative was a number at one point. Today it becomes a function in its own right — a narrator that follows f everywhere, reporting the slope at every x. Learning to read the narrator's graph against the original is one of the great skills of this course.",
        objectives:[
          "Sketch f′'s graph qualitatively from f's graph.",
          "Match rising, falling, and pausing in f to the sign of f′.",
          "Identify points where f′ fails to exist and say why." ],
        lecture:[
          ["From a number to a function","Compute the tangent slope at every x and collect the results: that is f′, a function whose input is a place and whose output is the steepness there. f′(x) = 2x for f(x) = x² — every point of the parabola, narrated at once. One caution: f′'s domain can be smaller than f's, because f can exist at points where it has no single slope."],
          ["Sign tells the story","Where f climbs, its tangents tilt up: f′ is positive. Where f falls, f′ is negative. Where f pauses at a crest or trough, the tangent lies flat and f′ crosses zero. You can sketch the narrator without a single formula."],
          ["Example — sketching f′ under f","Given only f's graph, build f′ point by point: at each x, eyeball the tangent's slope and plot THAT NUMBER as a height directly below. Horizontal tangents — crest, trough, or a flat shoulder — pin f′ to the x-axis first; then fill in positive arcs under the climbs and negative arcs under the falls. Three pinned zeros and the signs between them usually determine the whole sketch."],
          ["Example — a derivative from a table","The brewing lab logs yeast: B(4) = 61, B(6) = 74, B(8) = 89 thousand cells. No formula — but B′(6) is still estimable by the symmetric average: (89 − 61)/(8 − 4) = 7 thousand cells per hour. Straddling 6 with data from both sides beats leaning to one side. Run the estimate down the whole table and you discover the narrator's shape: growth accelerating, peaking, easing — the derivative of data you merely measured."],
          ["Example — a formula for f′ by definition","f(x) = 8x − 2x²: the difference quotient (8(x+h) − 2(x+h)² − 8x + 2x²)/h simplifies to 8 − 4x − 2h, and h → 0 leaves f′(x) = 8 − 4x. Read the narration back: positive until x = 2, zero at 2, negative after — so f climbs to a crest at x = 2 and falls forever after. The formula and the story confirm each other; when they don't, the algebra is wrong."],
          ["Where narration fails","A corner has two competing slopes, so f′ has no single value there — |x| at zero is the classic. A jump is worse: you cannot even lean a tangent on it. Differentiable points are the smooth ones."],
          ["The one-way street","Differentiable implies continuous — smoothness is a luxury built on unbrokenness. But continuous does not imply differentiable: |x| is unbroken at 0 and still cornered. The implication runs one way only."] ],
        viz:{ kind:"derivfn", note:"Gold is f, blue is its narrator f′. Slide the marker: the tangent's tilt on f always equals the blue curve's height — rising, falling, pausing, reported live." },
        worked:{ prompt:"f(x) = x³ − 3x. Where is f′ zero, and what is f doing there?",
          steps:[
            ["Differentiate.","f′(x) = 3x² − 3 — the power rule arrives officially next unit; here it confirms what the picture shows."],
            ["Solve f′ = 0.","3x² − 3 = 0 at x = −1 and x = 1."],
            ["Read the story.","Before −1, f′ is positive (climbing); between the roots it is negative (falling); after 1, positive again. So x = −1 is a crest and x = 1 a trough — the narrator told us without a graph of f."] ] },
        turn:[
          { q:"If f is falling on an interval, then on that interval f′ is…", type:"mc",
            opts:["positive","negative","zero","undefined"], a:1,
            hint:"Tangents tilt the way the curve goes.",
            work:"Falling graph, downhill tangents, negative narrator." },
          { q:"f(x) = |x − 2| fails to be differentiable at x = …", type:"num", ans:2, tol:0,
            hint:"Where is the corner?",
            work:"The kink sits at x = 2: slopes −1 and +1 collide, and no single derivative exists." } ],
        homework:{ title:"Homework 2.4 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*4);
            return { q:`f(x) = x². The narrator f′(x) = 2x reads what at x = ${a}?`, ans: 2*a, tol: 0 }; },
          () => { const c = 1 + Math.floor(Math.random()*6);
            return { q:`g(x) = |x − ${c}| has its corner — and no derivative — at x = …`, ans: c, tol: 0 }; },
          () => { const k = 2 + Math.floor(Math.random()*5);
            return { q:`h(x) = ${k}x + 3 has constant derivative h′(x) = …`, ans: k, tol: 0 }; } ] } },
      qs:[
        { q:"Where f is increasing, its derivative f′ is…", opts:["negative","zero","positive","undefined"], a:2, why:"Rising graph, positive slope." },
        { q:"At x = 0 the function |x| is…", opts:["differentiable but not continuous","continuous but not differentiable","neither","both"], a:1, why:"The corner has no single tangent slope." } ] } ] },
  { title:"Unit III · The Rules of Differentiation", sections:[
    { n:"3.1", t:"Short Cuts to Finding Derivatives",
      brief:"The limit definition is the meaning; the power rule is the shortcut. With linearity, whole polynomials differentiate at sight.",
      key:"d/dx xⁿ = n·xⁿ⁻¹.",
      full:{
        professor:"Unit II earned the derivative honestly, one limit at a time. Unit III collects the wages: rules that differentiate whole families of functions at sight. Today, powers and their combinations — and a first meeting with the derivative's own derivative.",
        objectives:[
          "Differentiate any power of x, including negative and fractional powers.",
          "Use linearity to differentiate sums and constant multiples.",
          "Compute a second derivative and say what it measures." ],
        lecture:[
          ["Start with the flat and the straight","Two derivatives you already know by pure geometry: a constant function graphs as a horizontal line, slope 0 everywhere, so (c)′ = 0. The identity f(x) = x graphs as the 45° line, slope 1 everywhere, so (x)′ = 1. Every shortcut today must agree with these two ground truths — and does."],
          ["The power rule","d/dx xⁿ = n·xⁿ⁻¹, for every real n. The exponent steps down front as a multiplier and drops by one. x⁵ → 5x⁴; √x = x^(1/2) → 1/(2√x); 1/x = x⁻¹ → −1/x². One rule, the whole family."],
          ["Example — the rule at sight","f(x) = x⁶ gives f′(x) = 6x⁵. y = x¹⁰⁰⁰ gives y′ = 1000x⁹⁹⁹ — a limit computation nobody would survive, done in a breath. P = t⁴ gives dP/dt = 4t³: Leibniz's d-notation names the input variable explicitly, which matters the moment functions of t, q and r start sharing a page."],
          ["Why negative powers obey too","Check n = −1 honestly: (1/x)′ by the quotient of differences works out to −1/x², and the power rule's prediction −1·x⁻² is the same thing. Fractional powers check out the same way. The rule isn't a whole-number coincidence; it is the family's genetic code."],
          ["Linearity","Derivatives respect sums and constants: differentiate term by term, carry constants along — (3x⁴)′ = 3 · 4x³ = 12x³ — and lone constants die (their graph is flat — slope zero). A polynomial now takes seconds instead of a limit computation."],
          ["Rewrite before you differentiate","The rule wants powers of x. So 1/x³ becomes x⁻³ first, and ∛x becomes x^(1/3). Most power-rule mistakes are really rewriting mistakes."],
          ["Example — a tangent line in seconds","Find the tangent to y = x³/4 at (2, 2). Differentiate: y′ = 3x²/4, so the slope at 2 is 3. Point-slope: y − 2 = 3(x − 2), i.e. y = 3x − 4. In Unit II this took a limit computation; today it takes one line — that is what the shortcut bought."],
          ["The derivative's derivative","f′ is a function, so it has its own derivative: f″, the rate of change of the rate of change. On a position graph f′ is velocity and f″ is acceleration. It returns in Unit IV as the curve's bending."] ],
        viz:{ kind:"derivfn", note:"The narrator again: gold f = x³ − 3x and blue f′ = 3x² − 3, now computable by today's rule in one line — slide and confirm the rule against the picture." },
        worked:{ prompt:"Differentiate f(x) = 4x³ − 6√x + 5, then find f″(x).",
          steps:[
            ["Rewrite for the rule.","√x is x^(1/2), so f(x) = 4x³ − 6x^(1/2) + 5."],
            ["Apply power rule + linearity.","f′(x) = 12x² − 3x^(−1/2), and the constant 5 vanishes."],
            ["Differentiate again.","f″(x) = 24x + (3/2)x^(−3/2) — the rule applied to f′, nothing new needed."] ] },
        turn:[
          { q:"f(x) = x⁴. f′(2) equals…", type:"num", ans:32, tol:0,
            hint:"4x³, then substitute.",
            work:"f′(x) = 4x³, so f′(2) = 32." },
          { q:"The derivative of a lone constant is always…", type:"num", ans:0, tol:0,
            hint:"What is the slope of a flat line?",
            work:"Constants graph flat; flat means slope zero everywhere." } ],
        homework:{ title:"Homework 3.1 — parameters reshuffle each attempt", gen:[
          () => { const n = 2 + Math.floor(Math.random()*4), a = 1 + Math.floor(Math.random()*3);
            return { q:`f(x) = ${a}x${["²","³","⁴","⁵"][n-2]}. f′(1) = …`, ans: a*n, tol: 0 }; },
          () => { const a = 2 + Math.floor(Math.random()*4), b = 1 + Math.floor(Math.random()*5);
            return { q:`f(x) = ${a}x² − ${b}x + 7. f′(3) = …`, ans: 6*a - b, tol: 0 }; },
          () => { const a = 1 + Math.floor(Math.random()*4);
            return { q:`f(x) = ${a}x³. f″(2) = …`, ans: 12*a, tol: 0 }; } ] } },
      qs:[
        { q:"d/dx (x⁵) equals…", opts:["x⁴","5x⁴","5x⁵","x⁵/5"], a:1, why:"Bring the power down, drop it by one." },
        { q:"d/dx (3x² − 4x + 7) equals…", opts:["6x − 4","3x − 4","6x + 7","6x² − 4"], a:0, why:"Term by term; constants vanish." } ] },
    { n:"3.2", t:"Introduction to Marginal Analysis",
      brief:"Economics reads the derivative as 'marginal': marginal cost is the rate at which cost grows, and it approximates the cost of the very next unit.",
      key:"C(x+1) − C(x) ≈ C′(x).",
      full:{
        professor:"Here is where this course earns the word 'applied'. Economists renamed the derivative 'marginal' and built a discipline on it: marginal cost, marginal revenue, marginal profit are all the same calculus wearing a suit. If you can differentiate, you can already read them.",
        objectives:[
          "Interpret C′(x) as the approximate cost of the next unit.",
          "Compute marginal cost, revenue and profit from models.",
          "Compare marginal and average cost and say which decisions each informs." ],
        lecture:[
          ["The shape of a cost curve","Real cost functions are usually low-degree polynomials: C(q) = a + bq + cq² or with a dq³ term. The constant a is fixed cost — rent and salaries you pay at q = 0 — and everything else is variable cost. Why would cost ever need a cubic term? Overtime and large-scale inefficiency: the ten-thousandth unit can cost more to squeeze out than the hundredth. The polynomial's shape is economics, not decoration."],
          ["The next-unit question","Business rarely asks 'what did all production cost?' It asks 'what does ONE MORE cost?' That is a difference C(x+1) − C(x) — and for smooth cost curves the derivative C′(x) approximates it beautifully, one tangent line instead of two evaluations."],
          ["Why the approximation works","In the derivative's definition h shrinks to zero; here we cheat and stop at h = 1. That's legitimate when output runs in the hundreds or thousands — next to q = 1000, a step of 1 IS small. Then C′(q) ≈ (C(q+1) − C(q))/1: the marginal cost is, to excellent accuracy, the literal cost of the next unit."],
          ["Example — a full marginal workup","A workshop estimates C(q) = 1800 + 10q − 0.006q² + 0.000002q³ dollars for q units a week. Fixed costs: C(0) = $1800. Average cost at q = 1000: C(1000) = 7800, so $7.80 a unit. Marginal cost: C′(q) = 10 − 0.012q + 0.000006q², so C′(1000) = 10 − 12 + 6 = $4.00 — the thousand-and-first unit costs about four dollars. The exact difference C(1001) − C(1000) works out to $4.004: the tangent missed by four-tenths of a cent."],
          ["Riding the tangent further","Predicting from the derivative means walking along the tangent line instead of the curve — a linear approximation. It even survives more than one step: at C′(1000) = $4.00, the next 50 units cost about 50 × 4 = $200, accurate while the curve stays close to its tangent. How far you can ride depends on how fast the curve bends — which is f″ talking, and Unit IV listens."],
          ["Marginal everything","R′(x) is marginal revenue; P(x) = R(x) − C(x) makes P′ = R′ − C′ marginal profit. When marginal profit is positive, the next unit is worth making. Where it crosses zero is Unit IV's whole story."],
          ["Marginal is not average","Average cost C(x)/x spreads the total over every unit made; marginal charges only the next one. In the workshop above the average was $7.80 while the marginal was $4.00 — the fixed 1800 inflates the average, but it has no say in what the NEXT unit costs. The two answer different questions, and mixing them up is a classic exam trap."] ],
        viz:{ kind:"marginal", note:"Ride the tangent along a cost curve: the readout's marginal figure is the tangent slope — the near-exact price of the next unit at every x." },
        worked:{ prompt:"C(x) = 0.05x² + 4x + 200. Find the marginal cost at x = 30 and compare it with the true cost of unit 31.",
          steps:[
            ["Differentiate the model.","C′(x) = 0.1x + 4."],
            ["Read the marginal.","C′(30) = 3 + 4 = 7 — the tangent predicts unit 31 costs about 7."],
            ["Check against the truth.","C(31) − C(30) = (48.05 + 124 + 200) − (45 + 120 + 200) = 7.05. The tangent missed by five cents — that is why economists trust it."] ] },
        turn:[
          { q:"C(x) = 0.2x² + 50. Marginal cost at x = 10 is…", type:"num", ans:4, tol:0,
            hint:"Differentiate, then substitute.",
            work:"C′(x) = 0.4x → C′(10) = 4." },
          { q:"Marginal profit equals…", type:"mc",
            opts:["R′ + C′","R′ − C′","R − C","R′ · C′"], a:1,
            hint:"Profit is revenue minus cost — differentiate that sentence.",
            work:"P = R − C, so P′ = R′ − C′: next-unit revenue minus next-unit cost." } ],
        homework:{ title:"Homework 3.2 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*4), x0 = 10*(1 + Math.floor(Math.random()*3));
            return { q:`C(x) = 0.${a}x² + 100. Marginal cost at x = ${x0}? (1 decimal)`, ans: +(2*(a/10)*x0).toFixed(1), tol: 0.05 }; },
          () => { const r = 20 + 5*Math.floor(Math.random()*4), c = 4 + Math.floor(Math.random()*6);
            return { q:`R′(x) = ${r} and C′(x) = ${c} at today's output. Marginal profit?`, ans: r - c, tol: 0 }; },
          () => { const a = 2 + Math.floor(Math.random()*3);
            return { q:`C(x) = ${a}x + 500. The marginal cost at ANY output is…`, ans: a, tol: 0 }; } ] } },
      qs:[
        { q:"With C(x) = 0.1x² + 50, the marginal cost at x = 20 is…", opts:["4","54","90","0.1"], a:0, why:"C′(x) = 0.2x, so C′(20) = 4." },
        { q:"Marginal revenue R′(x) best approximates…", opts:["total revenue so far","the revenue from one more unit","average revenue per unit","fixed revenue"], a:1, why:"A derivative is change per one more unit." } ] },
    { n:"3.3", t:"The Product and Quotient Rules",
      brief:"Products do not differentiate factor-by-factor; each factor takes its turn being differentiated while the other stands still. Quotients follow with a minus sign and a square.",
      key:"(fg)′ = f′g + fg′.",
      full:{
        professor:"Here is the unit's one genuine surprise: the derivative of a product is NOT the product of the derivatives. Try f = g = x and watch the naive guess fail. The true rule is stranger and lovelier — each factor takes a turn changing while the other holds still.",
        objectives:[
          "Apply the product rule and explain each of its two terms.",
          "Apply the quotient rule with the signs in the right places.",
          "Choose between expanding first and using the rules." ],
        lecture:[
          ["The naive guess dies fast","If (fg)′ were f′g′, then x·x = x² would have derivative 1·1 = 1. But (x²)′ = 2x. One counterexample, guess buried — we need the real rule."],
          ["A rectangle explains it","Let a rectangle have width f and height g. When x nudges forward, the area gains two strips: a vertical one, f′ wide and g tall, and a horizontal one, f wide and g′ tall. Total gain: f′g + fg′. The corner sliver is too small to matter — that's the limit doing its quiet work."],
          ["Example — the rule, twice over","y = x·eˣ: each factor takes its turn, y′ = 1·eˣ + x·eˣ = (x + 1)eˣ. And y″? Product rule again on (x + 1)eˣ: y″ = eˣ + (x + 1)eˣ = (x + 2)eˣ. Notice the narration holds: y′ = (x+1)eˣ is negative left of −1 and positive right of it, exactly where the graph of x·eˣ falls then rises."],
          ["Example — when expanding beats the rule","g(t) = 3t²(2 + 4t) by the product rule: 3t²·4 + (2 + 4t)·6t = 36t² + 12t. Or distribute first — g(t) = 6t² + 12t³ — and power-rule to 12t + 36t²: identical. Both roads are legal; take the shorter one. The rules earn their keep when expanding is ugly or impossible — x·eˣ has no expansion; the product rule is the only door."],
          ["Example — rules without formulas","Sometimes you know values, not formulas: f(x) = x²·g(x) where all you're told is g(2) = 5 and g′(2) = −1. The product rule doesn't mind: f′(2) = 2x·g + x²·g′ at x = 2 gives 4·5 + 4·(−1) = 16. Rules operate on information, not just on symbols — a favourite exam move."],
          ["The quotient rule","(f/g)′ = (f′g − fg′)/g². Low-d-high minus high-d-low, over low squared. The minus sign and the order in the numerator are where every lost point on this topic goes."],
          ["Example — a horizontal tangent found honestly","y = eˣ/(x² − 2x + 2). Quotient rule: y′ = eˣ(x² − 2x + 2 − (2x − 2))/(x² − 2x + 2)² = eˣ(x − 2)²/(x² − 2x + 2)². The numerator's square makes y′ ≥ 0 everywhere — the curve never falls — yet at x = 2 the derivative is exactly zero: the graph flattens for an instant at (2, e²/2), touches its horizontal tangent, and climbs on. The formula found a feature no plot would make obvious."] ],
        viz:{ kind:"prodrect", note:"The product rule drawn: as x grows, the f-by-g rectangle gains one strip because f grew and another because g grew — two strips, two terms." },
        worked:{ prompt:"Differentiate y = x² · eˣ.",
          steps:[
            ["Name the factors.","f = x², g = eˣ; f′ = 2x, and eˣ is its own derivative."],
            ["Each takes a turn.","y′ = f′g + fg′ = 2x·eˣ + x²·eˣ."],
            ["Tidy.","y′ = eˣ·x(2 + x). Factoring reveals where y′ = 0: at x = 0 and x = −2 — Unit IV will care."] ] },
        turn:[
          { q:"y = x·eˣ. y′(0) equals…", type:"num", ans:1, tol:0,
            hint:"y′ = eˣ + x·eˣ, then substitute 0.",
            work:"y′(0) = e⁰ + 0 = 1." },
          { q:"In the quotient rule's numerator, the term with the minus sign is…", type:"mc",
            opts:["f′g","fg′","f′g′","g²"], a:1,
            hint:"Low d-high MINUS high d-low.",
            work:"(f′g − fg′)/g² — the top function's turn comes first, the bottom's turn is subtracted." } ],
        homework:{ title:"Homework 3.3 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*3);
            return { q:`y = ${a}x·eˣ. y′(0) = …`, ans: a, tol: 0 }; },
          () => { const n = 2 + Math.floor(Math.random()*3);
            return { q:`y = x${n === 2 ? "²" : "³"}·eˣ. y′(1) as a multiple of e: the multiplier is…`, ans: n + 1, tol: 0 }; },
          () => { const c = 2 + Math.floor(Math.random()*4);
            return { q:`y = ${c}/x. y′(1) = …`, ans: -c, tol: 0 }; } ] } },
      qs:[
        { q:"d/dx (x·eˣ) equals…", opts:["eˣ","x·eˣ","eˣ + x·eˣ","eˣ − x·eˣ"], a:2, why:"First times derivative of second, plus second times derivative of first." },
        { q:"(f/g)′ equals…", opts:["f′/g′","(f′g − fg′)/g²","(f′g + fg′)/g²","f′g − fg′"], a:1, why:"Low d-high minus high d-low, over the square of what's below." } ] },
    { n:"3.4", t:"The Chain Rule",
      brief:"For a function inside a function, differentiate the outside at the inside, then multiply by the inside's own derivative — rates compound like gears.",
      key:"d/dx f(g(x)) = f′(g(x)) · g′(x).",
      full:{
        professor:"The chain rule is the most-used rule in all of calculus, because composition is everywhere: models live inside models. The idea is gears — the outer wheel turns so-fast per turn of the inner, the inner so-fast per unit of x, and rates through a chain multiply.",
        objectives:[
          "Spot the inner and outer function in a composite.",
          "Differentiate composites with the chain rule.",
          "Combine the chain rule with the power rule on (stuff)ⁿ." ],
        lecture:[
          ["Rates multiply through a chain","If y changes 3 times as fast as u, and u changes 2 times as fast as x, then y changes 6 times as fast as x. That's the whole rule: dy/dx = (dy/du)·(du/dx). Everything else is bookkeeping."],
          ["Seeing the seam","(x² + 1)⁵ is the squaring-plus-one machine feeding the fifth-power machine. Finding the seam — what would you compute first on a calculator? — is the skill; the first thing you'd compute is the inner function."],
          ["The general power rule","(stuff)ⁿ differentiates to n·(stuff)ⁿ⁻¹ · (stuff)′. The old power rule, times one new factor: the inner derivative. Forgetting that trailing factor is the single most common differentiation error in existence."],
          ["Example — a big power, painlessly","y = (x² − 3)⁸⁰ would be an 80-term nightmare expanded. Chain rule: y′ = 80(x² − 3)⁷⁹ · 2x = 160x(x² − 3)⁷⁹, done in one line. And roots are just powers in disguise: A(v) = ∛(v² + v + 1) rewrites as (v² + v + 1)^(1/3), so A′(v) = (2v + 1) / (3(v² + v + 1)^(2/3)). Rewrite, chain, finish."],
          ["Example — a chain inside a product","y = (3x − 1)³(x² + 2)² needs the product rule FIRST, with a chain rule inside each turn: y′ = 9(3x − 1)²(x² + 2)² + 4x(3x − 1)³(x² + 2). Now factor the common pieces: y′ = (3x − 1)²(x² + 2)[9(x² + 2) + 4x(3x − 1)] = (3x − 1)²(x² + 2)(21x² − 4x + 18). Factored form isn't vanity — it's how Unit IV will read off where y′ = 0."],
          ["Exponentials in the wild","e^(kx) → k·e^(kx): the inner rate k steps out front. This tiny case powers every growth-and-decay model in 3.6 — nature writes exponents with functions inside, and the chain rule reads them."],
          ["Other bases, unmasked","What about 2ˣ, or 1.3ᵗ? Every base is secretly e: aˣ = e^(x ln a), so the chain rule gives (aˣ)′ = aˣ · ln a. A club growing 30% a year, P(t) = 40·(1.3)ᵗ, changes at P′(t) = 40·(1.3)ᵗ·ln 1.3 members per year — the mysterious ln a factor is just the inner derivative of x ln a doing its job."],
          ["Chains of three and more","y = f(u), u = g(x), x = h(t): then dy/dt = (dy/du)(du/dx)(dx/dt) — three gears, three ratios, one product. However deep models nest, the rule never changes shape; you just keep multiplying rates until you reach the variable you differentiate by."] ],
        viz:{ kind:"chain", note:"y = √(x² + 1): the readout shows the inner rate and the outer rate separately, and their product matching the tangent's slope exactly." },
        worked:{ prompt:"Differentiate y = (3x² + 1)⁴.",
          steps:[
            ["Find the seam.","Inner: u = 3x² + 1. Outer: u⁴."],
            ["General power rule.","y′ = 4(3x² + 1)³ · (inner)′."],
            ["Finish the inner.","(3x² + 1)′ = 6x, so y′ = 24x(3x² + 1)³. The trailing 6x is the factor the naive answer forgets."] ] },
        turn:[
          { q:"y = (x² + 3)³. y′(1) equals…", type:"num", ans:96, tol:0,
            hint:"3(x²+3)² times the inner derivative 2x.",
            work:"3·16·2 = 96 — outer rule, then the inner factor." },
          { q:"d/dx e^(5x) = …", type:"mc",
            opts:["e^(5x)","5e^(5x)","5e⁵","e⁵ˣ/5"], a:1,
            hint:"The inner function is 5x; its rate steps out front.",
            work:"Chain rule: outer eᵘ stays, times inner derivative 5." } ],
        homework:{ title:"Homework 3.4 — parameters reshuffle each attempt", gen:[
          () => { const k = 2 + Math.floor(Math.random()*5);
            return { q:`y = e^(${k}x). y′(0) = …`, ans: k, tol: 0 }; },
          () => { const a = 1 + Math.floor(Math.random()*3);
            return { q:`y = (x² + ${a})². y′(1) = …`, ans: 4*(1 + a), tol: 0 }; },
          () => { const b = 2 + Math.floor(Math.random()*4);
            return { q:`y = (${b}x + 1)³. y′(0) = …`, ans: 3*b, tol: 0 }; } ] } },
      qs:[
        { q:"d/dx (x² + 1)⁵ equals…", opts:["5(x² + 1)⁴","10x(x² + 1)⁴","2x(x² + 1)⁵","5x(x² + 1)⁴"], a:1, why:"Outer power rule times inner derivative 2x." },
        { q:"d/dx e^(3x) equals…", opts:["e^(3x)","3e^(3x)","e³","3x·e^(3x)"], a:1, why:"The inner rate 3 multiplies out front." } ] },
    { n:"3.5", t:"Implicit Differentiation and Logarithms",
      brief:"When y hides inside an equation, differentiate both sides and solve for dy/dx — the curve never needed to be solved for y first. The logarithm's derivative, 1/x, is the bridge to growth problems.",
      key:"d/dx ln x = 1/x.",
      full:{
        professor:"Two doors open today. First: curves that never were y = f(x) — circles, ovals, tangled relations — can still be differentiated, without ever solving for y. Second: the logarithm gets its derivative, and it is the strangest one yet: a power function, 1/x, born from no power rule at all.",
        objectives:[
          "Differentiate a relation implicitly and solve for dy/dx.",
          "Use d/dx ln x = 1/x, with the chain rule for ln(inner).",
          "Find tangent slopes on curves like circles." ],
        lecture:[
          ["Curves that refuse to be solved","Some relations define y without surrendering a formula: x³ + y³ = 6xy — Descartes' folium, a looping curve that fails the vertical line test — cannot be solved for y as one function by any amount of algebra you'd want to do. Yet near most of its points it DOES pin y down locally. Implicit differentiation is how you differentiate what you cannot solve."],
          ["Differentiate the relation, not the solution","x² + y² = 25 defines y's dependence on x without a formula. Differentiate both sides anyway, remembering y is secretly a function of x: 2x + 2y·(dy/dx) = 0. Every y term picks up a dy/dx by the chain rule — that is the whole method."],
          ["Then just solve","dy/dx = −x/y. The slope depends on where you stand — top of the circle versus bottom — which is exactly right for a curve that is not a function. One equation, every tangent."],
          ["Example — an implicit demand curve","Price and weekly demand for the bookstore's hoodies are tangled: p·x + p² = 600, with no clean x = f(p) in sight. Differentiate in p: x + p·(dx/dp) + 2p = 0, so dx/dp = −(x + 2p)/p. At p = 20, x = 10: dx/dp = −50/20 = −2.5 — each extra dollar of price costs two and a half sales a week. Economics runs on relations more often than on functions; implicit differentiation is its native calculus."],
          ["The log's derivative","d/dx ln x = 1/x. The proof is implicit differentiation's party trick: write y = ln x as eʸ = x, differentiate to eʸ·y′ = 1, and y′ = 1/eʸ = 1/x."],
          ["ln of an inside","Chain rule as always: d/dx ln(g(x)) = g′(x)/g(x). The pattern (derivative over function) is worth memorising — 3.6 uses it to turn growth rates into equations."],
          ["Example — ln with machinery inside","f(x) = ln(x² + 4eˣ): the pattern gives f′(x) = (2x + 4eˣ)/(x² + 4eˣ) — inner derivative over inner function, one line. And a curiosity with consequences: f(x) = ln|x| has derivative 1/x for ALL x ≠ 0, negative side included. The absolute value costs nothing; integration will collect on that fact in Chapter 5."] ],
        viz:{ kind:"circle", note:"Ride the wheel: at every point of x² + y² = 25 the tangent's slope is −x/y, read live — no y = f(x) was ever solved for." },
        worked:{ prompt:"Find the tangent slope to x² + y² = 25 at (3, 4).",
          steps:[
            ["Differentiate both sides in x.","2x + 2y·y′ = 0 — the y² term contributes 2y·y′ by the chain rule, because y rides on x."],
            ["Solve for y′.","y′ = −x/y."],
            ["Stand at the point.","y′ = −3/4 at (3, 4). At (3, −4), the mirror point, it would be +3/4 — the formula knows which side of the circle you're on."] ] },
        turn:[
          { q:"d/dx ln x at x = 5 equals… (give a fraction as a decimal)", type:"num", ans:0.2, tol:0.001,
            hint:"1/x, evaluated.",
            work:"1/5 = 0.2." },
          { q:"On x² + y² = 100 at the point (6, 8), dy/dx = … (2 decimals)", type:"num", ans:-0.75, tol:0.01,
            hint:"The circle's slope is always −x/y.",
            work:"−6/8 = −0.75." } ],
        homework:{ title:"Homework 3.5 — parameters reshuffle each attempt", gen:[
          () => { const x = 3 + Math.floor(Math.random()*5);
            return { q:`d/dx ln x at x = ${x}? (3 decimals)`, ans: +(1/x).toFixed(3), tol: 0.002 }; },
          () => { const t = [[3,4],[6,8],[5,12],[8,6]][Math.floor(Math.random()*4)];
            return { q:`On x² + y² = ${t[0]*t[0]+t[1]*t[1]}, dy/dx at (${t[0]}, ${t[1]})? (2 decimals)`, ans: +(-t[0]/t[1]).toFixed(2), tol: 0.01 }; },
          () => { const k = 2 + Math.floor(Math.random()*4);
            return { q:`d/dx ln(${k}x) at x = 1 = …`, ans: 1, tol: 0.001 }; } ] } },
      qs:[
        { q:"d/dx ln x equals…", opts:["ln x","1/x","x·ln x","eˣ"], a:1, why:"The defining derivative of the natural log." },
        { q:"On the circle x² + y² = 25, dy/dx equals…", opts:["−x/y","x/y","−y/x","25 − x"], a:0, why:"2x + 2y·y′ = 0, so y′ = −x/y." } ] },
    { n:"3.6", t:"Exponential Growth and Decay",
      brief:"When a quantity's rate of change is proportional to its size, the solution is exponential — the one family of functions that is its own derivative up to a constant.",
      key:"dy/dt = k·y has solution y = y₀·e^(kt).",
      full:{
        professor:"Unit III closes with its payoff: the one differential equation everyone should know. 'It grows in proportion to its size' describes bacteria, bank balances, and decaying isotopes alike — and the chain rule we built this week is exactly what solves it.",
        objectives:[
          "Recognise proportional-rate stories as y′ = ky.",
          "Solve them with y = y₀·e^(kt) and fit k from data.",
          "Work half-life and doubling-time problems." ],
        lecture:[
          ["Example — steady percentage, exponential value","The flight club's trainer aircraft, worth $48,000, loses 4% of its value yearly — meaning it KEEPS 96%: V(t) = 48,000·(0.96)ᵗ. After five years, V(5) ≈ $39,140. When does it dip below half its value? Solve 0.5 = 0.96ᵗ with 1.6's tools: t = ln(0.5)/ln(0.96) ≈ 17 years. Constant-percentage change IS exponential change — appreciation and depreciation differ only in whether the factor sits above or below 1."],
          ["From compound to continuous","P dollars at rate r compounded n times a year grows to P(1 + r/n)^(nt). Crank n — monthly, daily, hourly — and the value climbs, but toward a ceiling, not to infinity: as n → ∞ the expression (1 + 1/m)^m inside marches to a familiar constant, e ≈ 2.71828. The ceiling is A = P·e^(rt): continuous compounding. At 5% for 10 years, $2000 gives $3282 quarterly and $3297 continuously — e is worth about fifteen dollars here."],
          ["The sentence that becomes an equation","'The rate of change is proportional to the amount present' — differentiate that sentence and you get y′ = ky. Positive k grows, negative k decays. This is a differential equation: an equation whose unknown is a FUNCTION, constraining its derivative. Recognising this sentence in a word problem is most of the work."],
          ["Why e solves it","We need a function whose derivative is k times itself. The chain rule says e^(kt) is exactly that: (e^(kt))′ = k·e^(kt). Scale by the starting amount and y = y₀·e^(kt) is the complete answer — substitute it into y′ = ky and watch both sides agree identically."],
          ["Example — a culture growing continuously","A dish starts at 3000 cells with continuous growth rate 8% per hour: P(t) = 3000·e^(0.08t). After four hours, P(4) = 3000·e^(0.32) ≈ 4131 cells. Note what 8% continuous means: not 'multiply by 1.08 hourly' but 'at every instant, growing at 8% of current size per hour' — the differential equation's sentence, spoken by biology."],
          ["Fitting k","Given 'the population doubles in 6 hours': 2y₀ = y₀e^(6k), so k = (ln 2)/6. The logarithm from 1.6 pulls k down out of the exponent — the tools of this course meshing."],
          ["Half-life is the same machine","A half-life of T means y = y₀·(1/2)^(t/T), or k = −(ln 2)/T in e-form. After two half-lives a quarter remains; after three, an eighth — halving compounds just like doubling."] ],
        viz:{ kind:"explog", note:"The base slider again, now read as e-powers: sweep from decay through frozen to growth and watch which stories — cooling coffee, spreading rumours — live at each base." },
        worked:{ prompt:"A sample decays with half-life 10 days. What fraction remains after 30 days, and what is k?",
          steps:[
            ["Count half-lives.","30 days is three half-lives: 1 → 1/2 → 1/4 → 1/8 remains."],
            ["Write the e-form.","y = y₀e^(kt) with (1/2) = e^(10k)."],
            ["Solve for k.","k = (ln ½)/10 = −(ln 2)/10 ≈ −0.0693 per day — negative, as decay demands."] ] },
        turn:[
          { q:"A population obeying y′ = 0.2y with y₀ = 100: after t = 5 it is about… (nearest whole)", type:"num", ans:272, tol:1,
            hint:"y = 100·e^(0.2·5) = 100·e.",
            work:"100·e¹ ≈ 271.8 — one 'e-fold' when kt reaches 1." },
          { q:"After 4 half-lives, the remaining fraction is 1 over…", type:"num", ans:16, tol:0,
            hint:"Halve four times.",
            work:"(1/2)⁴ = 1/16." } ],
        homework:{ title:"Homework 3.6 — parameters reshuffle each attempt", gen:[
          () => { const n = 2 + Math.floor(Math.random()*3);
            return { q:`After ${n} half-lives, remaining fraction = 1 over …`, ans: Math.pow(2, n), tol: 0 }; },
          () => { const T = [5,10,20][Math.floor(Math.random()*3)];
            return { q:`Doubling time ${T} hours: k = (ln 2)/${T} ≈ … (3 decimals)`, ans: +(Math.log(2)/T).toFixed(3), tol: 0.002 }; },
          () => { const y0 = 100*(1 + Math.floor(Math.random()*4));
            return { q:`y = ${y0}·e^(0.5t) at t = 2: about … (nearest whole)`, ans: Math.round(y0*Math.E), tol: 2 }; } ] } },
      qs:[
        { q:"'The rate of change is proportional to the amount present' is the equation…", opts:["y′ = k","y′ = k·y","y′ = k·t","y″ = k·y"], a:1, why:"Rate proportional to y itself." },
        { q:"After two half-lives, the remaining fraction of a sample is…", opts:["1/2","1/3","1/4","1/8"], a:2, why:"Half of a half." } ] } ] },
  { title:"Unit IV · Applications of the Derivative", sections:[
    { n:"4.1", t:"Related Rates",
      brief:"Two quantities tied by an equation share their rates: differentiate the relation with respect to time and the known rate reveals the unknown one.",
      key:"Relate the variables first; differentiate with respect to t second.",
      full:{
        professor:"Unit IV puts the derivative to work. First job: situations where several quantities move together through time — a balloon's radius and its volume, a ladder's foot and its top. Know one rate, and the geometry that ties the variables together hands you the other.",
        objectives:[
          "Translate a moving-geometry story into one relating equation.",
          "Differentiate that relation with respect to time.",
          "Substitute known rates and values only at the end." ],
        lecture:[
          ["The setup is the skill","Draw the situation. Name every changing quantity as a function of time. Then write ONE equation relating them — area to radius, Pythagoras for the ladder, similar triangles for the shadow. No numbers yet: numbers this early poison the method."],
          ["Time differentiates everything","Differentiate the relation with respect to t. Every variable picks up its own rate by the chain rule: A = πr² becomes dA/dt = 2πr·(dr/dt). The equation of quantities becomes an equation of rates."],
          ["Now, and only now, the numbers","Substitute the given moment's values and known rates, and solve for the one you want. Substituting before differentiating freezes a variable that was supposed to move — the classic fatal error."],
          ["Example — the sliding ladder","A 5-metre ladder leans on Halloran Hall; its foot slides away at 0.4 m/s. How fast does the top drop when the foot is 3 m out? Relate: x² + y² = 25. Differentiate: 2x·(dx/dt) + 2y·(dy/dt) = 0. At the moment in question y = 4 (Pythagoras), so dy/dt = −(3)(0.4)/4 = −0.3 m/s. The minus sign is the answer speaking: the top moves DOWN. And notice the same ladder slides faster later — at x = 4, dy/dt = −0.53 m/s — even though the foot's speed never changed."],
          ["Example — the stretching shadow","A student 1.8 m tall walks away from a 5.4-metre lamppost at 1.5 m/s. Similar triangles tie the distances: with x from post to student and s the shadow's length, 5.4/(x + s) = 1.8/s, which tidies to s = x/2. Differentiate: ds/dt = (1/2)(dx/dt) = 0.75 m/s — constant! The shadow grows at the same rate at every distance, a conclusion you'd never guess without the calculus, delivered before a single number went in."],
          ["Units are the audit","dA/dt should come out in area per time; if it doesn't, a rate got dropped. Reading your answer's units aloud catches more mistakes than re-doing the algebra."] ],
        viz:{ kind:"ripple", note:"A ripple grows at a steady dr/dt — yet the area's rate climbs and climbs, because dA/dt = 2πr·dr/dt carries the ever-larger r inside it." },
        worked:{ prompt:"A spherical balloon inflates at 20 cm³/s. How fast is the radius growing when r = 5 cm? (V = (4/3)πr³)",
          steps:[
            ["Relate, in general.","V = (4/3)πr³ — true at every instant, no numbers inserted."],
            ["Differentiate through time.","dV/dt = 4πr²·(dr/dt)."],
            ["Substitute the moment.","20 = 4π·25·(dr/dt), so dr/dt = 1/(5π) ≈ 0.064 cm/s — slower and slower as the balloon fattens, with the same air supply."] ] },
        turn:[
          { q:"A = πr², dr/dt = 3, r = 4: dA/dt = … (in multiples of π)", type:"num", ans:24, tol:0,
            hint:"dA/dt = 2πr·dr/dt — give the number multiplying π.",
            work:"2·4·3 = 24, so dA/dt = 24π." },
          { q:"The fatal error in related rates is…", type:"mc",
            opts:["drawing a picture","differentiating before substituting","substituting values before differentiating","using the chain rule"], a:2,
            hint:"What freezes a moving variable?",
            work:"Plug in early and a changing quantity becomes a constant with rate zero — differentiate first, substitute last." } ],
        homework:{ title:"Homework 4.1 — parameters reshuffle each attempt", gen:[
          () => { const r = 2 + Math.floor(Math.random()*5), dr = 1 + Math.floor(Math.random()*3);
            return { q:`A = πr², r = ${r}, dr/dt = ${dr}. dA/dt as a multiple of π: …`, ans: 2*r*dr, tol: 0 }; },
          () => { const x = 3 + Math.floor(Math.random()*3), dx = 2;
            return { q:`y = x². If dx/dt = ${dx} at x = ${x}, then dy/dt = …`, ans: 2*x*dx, tol: 0 }; },
          () => { const s0 = 2 + Math.floor(Math.random()*4);
            return { q:`A square's side grows at 1 unit/s. When the side is ${s0}, the area grows at …`, ans: 2*s0, tol: 0 }; } ] } },
      qs:[
        { q:"A circle's radius grows at 2 units/s. When r = 5, its area A = πr² grows at…", opts:["10π","20π","25π","4π"], a:1, why:"dA/dt = 2πr·dr/dt = 2π·5·2." },
        { q:"The first move in any related-rates problem is…", opts:["plug in the numbers","differentiate each variable separately","write one equation relating the variables","draw the tangent line"], a:2, why:"Numbers go in only after the relation is differentiated." } ] },
    { n:"4.2", t:"Maximum and Minimum Values",
      brief:"Peaks and valleys happen where the derivative is zero or fails to exist — the critical numbers — or at the ends of the interval. That short list is the whole search space.",
      key:"On a closed interval, a continuous function attains its extremes at critical numbers or endpoints.",
      full:{
        professor:"Optimization begins with a beautifully short list. A continuous function on a closed interval MUST have a biggest and smallest value — and they can only hide in two kinds of places. Find the critical numbers, check the endpoints, done. Today we make that list rigorous.",
        objectives:[
          "Find critical numbers: where f′ is zero or fails to exist.",
          "Run the closed-interval method to the exact max and min.",
          "Distinguish local from absolute extremes." ],
        lecture:[
          ["Why extremes run the unit","Optimization — the best price, the least material, the shortest route — is the derivative's biggest job, and every optimization problem reduces to the same task: find where a function is largest or smallest. Before we can find extremes we need to know exactly what they are and where they can hide."],
          ["Local versus absolute","A local max beats its neighbours; the absolute max beats everyone. Endpoints can host absolute extremes without any flat tangent — which is exactly why today's method checks them separately."],
          ["Example — a gallery of behaviours","f(x) = x² has an absolute minimum at 0 and no maximum — the arms climb forever. f(x) = x³ has neither: it never pauses. And a quartic on [−1, 4] can post its absolute maximum at the endpoint x = −1 with no flat tangent in sight, while its interior hosts a modest local max that wins only against its neighbours. Extremes come in more flavours than 'the top of the hill' — the definitions earn their keep."],
          ["Peaks flatten tangents","At an interior maximum the curve stops rising and starts falling — so the tangent lies flat, f′ = 0 (Fermat's observation). Same at a minimum, upside down. Corners can hide extremes too, where f′ doesn't exist. Together: the critical numbers — where f′ is zero or undefined — the only interior suspects."],
          ["Fermat's fine print","The arrow points one way only. Every interior extreme is a critical number — but not every critical number is an extreme: x³ has f′(0) = 0 and sails straight through, pausing without turning. And |x| bottoms out at a point with no derivative at all. Critical numbers are SUSPECTS, not convictions; the evaluation or a sign test delivers the verdict."],
          ["Example — hunting critical numbers","A(t) = t³ − 6t² − 36t + 40: the derivative A′(t) = 3t² − 12t − 36 = 3(t − 6)(t + 2) is defined everywhere, so the only critical numbers are its zeros, t = 6 and t = −2. Contrast g(x) = x^(2/3): its derivative (2/3)x^(−1/3) is never zero but fails to exist at x = 0 — and that cusp is precisely where g bottoms out. Both kinds of critical number are real, and both must be collected."],
          ["Guaranteed extremes","The Extreme Value Theorem: continuous on a closed interval [a, b] means an absolute max and min are attained — not approached, attained. Openness or a break voids the warranty: 1/x on (0, 1] has no maximum at all."],
          ["The closed-interval method","Compute f at every critical number inside, and at both endpoints. Largest value wins, smallest loses. No second derivatives, no sign charts — for absolute extremes on a closed interval, arithmetic on a short list settles it."] ],
        viz:{ kind:"derivfn", note:"Watch the narrator vanish at the extremes: wherever gold f crests or bottoms, blue f′ crosses zero — the flat-tangent moments are the critical numbers." },
        worked:{ prompt:"Find the absolute extremes of f(x) = x³ − 3x² + 1 on [−1, 4].",
          steps:[
            ["Critical numbers.","f′(x) = 3x² − 6x = 3x(x − 2): zero at x = 0 and x = 2, both inside the interval."],
            ["Evaluate the short list.","f(−1) = −3, f(0) = 1, f(2) = −3, f(4) = 17."],
            ["Read off the answers.","Absolute max 17 at the endpoint x = 4; absolute min −3, achieved twice — at x = −1 and x = 2. Endpoints matter."] ] },
        turn:[
          { q:"The critical number of f(x) = x² − 6x + 2 is x = …", type:"num", ans:3, tol:0,
            hint:"Solve f′ = 0.",
            work:"f′ = 2x − 6 = 0 at x = 3." },
          { q:"The Extreme Value Theorem needs continuity and…", type:"mc",
            opts:["differentiability","a closed interval","a positive function","symmetry"], a:1,
            hint:"Which kind of interval keeps its endpoints?",
            work:"Closed and bounded: [a, b]. Lose an endpoint and the max can escape." } ],
        homework:{ title:"Homework 4.2 — parameters reshuffle each attempt", gen:[
          () => { const b = 2*(1 + Math.floor(Math.random()*4));
            return { q:`f(x) = x² − ${b}x + 3: critical number at x = …`, ans: b/2, tol: 0 }; },
          () => { const c = 1 + Math.floor(Math.random()*4);
            return { q:`f(x) = x³ − ${3*c*c}x: the positive critical number is x = …`, ans: c, tol: 0 }; },
          () => { const k = 1 + Math.floor(Math.random()*5);
            return { q:`f(x) = x² on [−1, ${k}]: the absolute maximum value is …`, ans: k*k, tol: 0 }; } ] } },
      qs:[
        { q:"The critical number of f(x) = x² − 4x + 1 is x =…", opts:["1","2","4","−2"], a:1, why:"f′(x) = 2x − 4 = 0." },
        { q:"The Extreme Value Theorem guarantees a max and min when f is…", opts:["differentiable everywhere","continuous on a closed interval","increasing","positive"], a:1, why:"Continuity plus a closed, bounded interval." } ] },
    { n:"4.3", t:"Derivatives and the Shapes of Curves",
      brief:"The first derivative narrates direction; the second narrates bending. Together they turn a formula into a silhouette.",
      key:"f′ positive: rising. f″ positive: concave up — the cup holds water.",
      full:{
        professor:"A first derivative says which way; a second says how the way itself is changing. Together they classify every smooth curve's behaviour — rising or falling, cupped or domed — and give us a test that tells peaks from valleys without ever looking at a graph.",
        objectives:[
          "Build a sign chart for f′ and read increase and decrease.",
          "Use f″ for concavity and locate inflection points.",
          "Classify critical points with the second derivative test." ],
        lecture:[
          ["The sign chart","Mark f′'s zeros on a number line and test a point in each gap. Positive stretch: f rises. Negative: f falls. Where the sign flips, a local extreme sits — plus-to-minus is a peak, minus-to-plus a valley. This is the first derivative test, and it never lies."],
          ["Example — a chart with three suspects","f(x) = 3x⁴ − 4x³ − 12x² + 6: f′(x) = 12x³ − 12x² − 24x = 12x(x − 2)(x + 1), critical at −1, 0, 2. Four intervals, one test point each: at −2 the product is negative (falling); at −½ positive (rising); at 1 negative (falling); at 3 positive (rising). Verdicts by sign flip: minima at x = −1 and x = 2 — f(−1) = 1, f(2) = −26 — and a local max at x = 0, f(0) = 6. Three factor signs per row, arranged in a chart: bookkeeping, not brilliance."],
          ["Concavity is the second story","f″ positive means f′ is increasing — the curve bends upward, a cup. f″ negative bends it downward, a dome. Where the bending flips sign, the curve has an inflection point: the S-bend's waist."],
          ["Example — concavity read straight off a graph","Sketch tangents along a curve and watch their slopes as you move right. Slopes increasing — even from steep-negative toward flat — is concave UP, and the curve sits above its tangents. Slopes decreasing is concave DOWN, curve below its tangents. On an S-shaped enrollment curve the slopes rise until the steepest moment, then ease: that steepest instant IS the inflection point, no formula required."],
          ["The second derivative test","At a critical point with f′(c) = 0: if f″(c) is positive the curve is cupped there, so c is a minimum; negative, a dome, so a maximum. If f″(c) = 0 the test shrugs — fall back to the sign chart."],
          ["Reading curves like sentences","Rising-and-cupped means growth accelerating; rising-and-domed means growth running out of steam — the inflection point is where 'faster and faster' turns into 'slower and slower'. Economists watch that point like hawks."] ],
        viz:{ kind:"derivfn", note:"Follow both stories at once: f′'s sign gives rising or falling, and where the blue narrator itself rises or falls is the gold curve's concavity." },
        worked:{ prompt:"Classify the critical points of f(x) = x³ − 6x² + 5.",
          steps:[
            ["Critical numbers.","f′ = 3x² − 12x = 3x(x − 4): x = 0 and x = 4."],
            ["Second derivative test.","f″ = 6x − 12. f″(0) = −12, negative → dome → local max. f″(4) = +12, positive → cup → local min."],
            ["The inflection.","f″ = 0 at x = 2: bending flips from dome to cup exactly halfway between the extremes — no coincidence for a cubic."] ] },
        turn:[
          { q:"f″(x) = 6x − 18: the inflection point sits at x = …", type:"num", ans:3, tol:0,
            hint:"Where does the bending change sign?",
            work:"f″ = 0 at x = 3, and its sign genuinely flips there." },
          { q:"f′(c) = 0 and f″(c) = −8. The point c is a…", type:"mc",
            opts:["local minimum","local maximum","inflection point","saddle"], a:1,
            hint:"Negative second derivative means a dome.",
            work:"Flat tangent on a dome: local maximum." } ],
        homework:{ title:"Homework 4.3 — parameters reshuffle each attempt", gen:[
          () => { const a = 2 + Math.floor(Math.random()*4);
            return { q:`f(x) = x³ − ${3*a}x². The inflection is at x = …`, ans: a, tol: 0 }; },
          () => { const k = 1 + Math.floor(Math.random()*5);
            return { q:`f″(x) = 2x − ${2*k}: f is concave UP for x greater than …`, ans: k, tol: 0 }; },
          () => { const c = 2 + Math.floor(Math.random()*3);
            return { q:`f(x) = x² + ${c}: f″(0) = …`, ans: 2, tol: 0 }; } ] } },
      qs:[
        { q:"If f′ changes from positive to negative at c, then f has…", opts:["a local minimum at c","a local maximum at c","an inflection at c","an asymptote at c"], a:1, why:"Rising then falling is a peak." },
        { q:"Where f″(x) is positive, the graph is…", opts:["concave up","concave down","decreasing","linear"], a:0, why:"Positive second derivative bends upward." } ] },
    { n:"4.4", t:"Asymptotes",
      brief:"Asymptotes are the graph's long-run promises: horizontal ones are limits at infinity, vertical ones stand where the function blows up.",
      key:"For rational functions, compare leading terms for the horizontal asymptote.",
      full:{
        professor:"Today's question is the long run: what does a function promise to do as x runs to infinity, and where does it simply blow up? Asymptotes are those promises drawn as dashed lines — and they are limits again, wearing their most practical clothes.",
        objectives:[
          "Compute limits at infinity for rational functions.",
          "Find horizontal asymptotes by comparing degrees.",
          "Locate vertical asymptotes and distinguish them from holes." ],
        lecture:[
          ["The grammar of infinity","Writing lim (x → 0) 1/x² = ∞ does NOT mean the limit exists and equals some number called infinity — ∞ is not a number. It records the particular WAY the limit fails: the outputs grow beyond every bound. Read it aloud as 'increases without bound'. There is a negative twin, → −∞, and one-sided versions from each flank — precise language for behaviour that has no destination."],
          ["Example — reading a blowup's signs","y = 1/(x − 3) near x = 3: approach from the right and the denominator is a tiny POSITIVE number, so y → +∞; from the left, tiny negative, so y → −∞. One wall, two behaviours — and you can predict both from the sign of the denominator alone, before any graph. Every rational function's vertical asymptote yields to this little sign interrogation."],
          ["Limits at infinity","As x grows huge, 1/x, 1/x², all the reciprocal powers die to zero. Divide a rational function through by the highest power below and everything but the leading terms evaporates — what's left is the limit."],
          ["The degree comparison","Same degree top and bottom: the horizontal asymptote is the ratio of leading coefficients. Bottom heavier: y = 0. Top heavier: no horizontal asymptote — the function escapes every ceiling."],
          ["Vertical blowups","Where the denominator hits zero and the numerator doesn't, values explode: a vertical asymptote. The curve never crosses it; it climbs or plunges alongside. In applied terms it is a wall — demand near a giveaway price, cost per unit as units go to zero."],
          ["Blowup or hole?","If the offending factor cancels — as in 2.2 — the graph has a removable hole, not a wall. Factor completely before declaring an asymptote; the algebra distinguishes a missing point from an impassable line."],
          ["End behaviour without a ceiling","Polynomials have no horizontal asymptotes, but their long run is still knowable: x³ − 3x + 1 behaves like x³ far out, so it plunges to −∞ on the left and climbs to +∞ on the right — 1.4's leading-term rule, now stated as infinite limits at infinity. 'No asymptote' never means 'no information'."] ],
        viz:{ kind:"asym", note:"Ride the branch outward: the marker's height settles toward the dashed y = 2 — the ratio of the leading coefficients — while x = 3 stands as the wall it can never touch." },
        worked:{ prompt:"Find all asymptotes of f(x) = (3x² + 1)/(x² − 4).",
          steps:[
            ["Horizontal: compare degrees.","Both degree 2 → asymptote at the coefficient ratio, y = 3."],
            ["Vertical: factor the bottom.","x² − 4 = (x − 2)(x + 2), zero at x = ±2."],
            ["Check for cancellation.","The numerator 3x² + 1 is never zero at ±2, nothing cancels: honest walls at x = 2 and x = −2, and the ceiling y = 3 for the long run."] ] },
        turn:[
          { q:"The horizontal asymptote of y = (6x + 1)/(2x − 5) is y = …", type:"num", ans:3, tol:0,
            hint:"Leading coefficients, top over bottom.",
            work:"6/2 = 3 — the +1 and −5 are long-run noise." },
          { q:"y = (x + 1)/((x − 4)(x + 2)) has vertical asymptotes at…", type:"mc",
            opts:["x = 4 only","x = −2 only","x = 4 and x = −2","x = −1"], a:2,
            hint:"Bottom zero, top not — check both factors.",
            work:"Neither factor cancels with x + 1: walls at 4 and −2." } ],
        homework:{ title:"Homework 4.4 — parameters reshuffle each attempt", gen:[
          () => { const a = 2 + Math.floor(Math.random()*5), b = 1 + Math.floor(Math.random()*3);
            return { q:`Horizontal asymptote of y = (${a*b}x + 7)/(${b}x − 1): y = …`, ans: a, tol: 0 }; },
          () => { const c = 2 + Math.floor(Math.random()*5);
            return { q:`y = 1/(x − ${c}) has its vertical asymptote at x = …`, ans: c, tol: 0 }; },
          () => { const n = 1 + Math.floor(Math.random()*4);
            return { q:`lim (x → ∞) of ${n}/x² + 5 = …`, ans: 5, tol: 0 }; } ] } },
      qs:[
        { q:"The horizontal asymptote of y = (2x + 1)/(x − 3) is…", opts:["y = 0","y = 2","y = 3","y = −1/3"], a:1, why:"Leading coefficients: 2/1." },
        { q:"y = 1/(x² − 4) has vertical asymptotes at…", opts:["x = 4 only","x = 2 only","x = 2 and x = −2","none"], a:2, why:"The denominator vanishes at ±2 with no cancellation." } ] },
    { n:"4.5", t:"Curve Sketching",
      brief:"A sketch is an argument: domain, intercepts, asymptotes, then the sign charts of f′ and f″ assemble the curve before a single point is plotted.",
      key:"Sign charts of f′ and f″ carve the axis into pieces where the shape cannot change.",
      full:{
        professor:"Curve sketching is the unit's dress rehearsal: every tool we've built — domains, asymptotes, sign charts, concavity — deployed together to draw a function you have never seen. The point isn't the drawing; it's that the checklist forces the function to confess everything.",
        objectives:[
          "Run the full sketching checklist in order.",
          "Combine f′ and f″ sign charts into one shape story.",
          "Sketch a rational function with its asymptotes." ],
        lecture:[
          ["The checklist","Domain first, then intercepts, then asymptotes, then f′'s chart, then f″'s. Each stage constrains the picture further; by the end there is usually only one curve left that satisfies everything you know."],
          ["Four shapes, one alphabet","Rising-cupped, rising-domed, falling-cupped, falling-domed: every smooth stretch of every curve is one of these four. The sign pair (f′, f″) picks the letter, and the charts say where the letters change."],
          ["Example — a full dress rehearsal","f(x) = x³ − 3x + 2, the whole checklist: domain all reals; f′ = 3(x − 1)(x + 1) gives rising–falling–rising with a local max at (−1, 4) and local min at (1, 0); f″ = 6x flips concavity dome-to-cup at the inflection (0, 2); end behaviour x³: down-left, up-right. Plot exactly three points — the two extremes and the inflection — connect them respecting the letters, and the sketch is done. Every mark on it is a theorem, not a guess."],
          ["Asymptotes frame the page","Draw the dashed lines before the curve: they are the rails the sketch must respect at its edges. A curve that crosses its own vertical asymptote is a wrong answer announcing itself."],
          ["When the window lies","Graphing devices are superb and gullible: the default window on a sixth-degree polynomial can swallow a dip whole, showing a clean curve where two extremes hide. Calculus is the zoom advisor — f′'s zeros say where the action is, so you point the window THERE. Technology draws; the derivative decides what deserves drawing."],
          ["Sketch to check, not to decorate","In the calculator age the sketch's value is diagnostic: if your chart says falling-domed and your plot shows a rise, one of them is lying, and finding out which is where the understanding happens."] ],
        viz:{ kind:"derivfn", note:"One last visit to the narrator: read (f′ sign, f″ sign) stretch by stretch and name each of the cubic's four letters — the whole sketch is in the readout." },
        worked:{ prompt:"Sketch-plan f(x) = x³ − 3x + 1: where is it rising, falling, cupped, domed?",
          steps:[
            ["First chart.","f′ = 3x² − 3 = 0 at x = ±1: rising, then falling between −1 and 1, then rising."],
            ["Second chart.","f″ = 6x: domed left of 0, cupped right — one inflection at the origin's x."],
            ["Assemble.","Rising-domed to x = −1 (crest), falling-domed to 0, falling-cupped to 1 (trough), rising-cupped after. Four letters, one S-shaped cubic — drawn before plotting a single point."] ] },
        turn:[
          { q:"On a stretch where f′ is negative and f″ is positive, the curve is…", type:"mc",
            opts:["rising and cupped","rising and domed","falling and cupped","falling and domed"], a:2,
            hint:"First sign is direction, second is bending.",
            work:"Falling (f′ negative) into a cup (f″ positive) — the classic approach to a minimum." },
          { q:"f(x) = x³ − 12x has its crest (local max) at x = …", type:"num", ans:-2, tol:0,
            hint:"f′ = 3x² − 12; which root has f falling after it?",
            work:"Roots ±2; f″(−2) = −12, domed, so the crest is at −2." } ],
        homework:{ title:"Homework 4.5 — parameters reshuffle each attempt", gen:[
          () => { const a = 1 + Math.floor(Math.random()*4);
            return { q:`f(x) = x³ − ${3*a*a}x: the trough (local min) is at x = …`, ans: a, tol: 0 }; },
          () => { const k = 2 + Math.floor(Math.random()*4);
            return { q:`f″(x) = 6x − ${6*k}: the inflection sits at x = …`, ans: k, tol: 0 }; },
          () => { const c = 2 + Math.floor(Math.random()*4);
            return { q:`y = ${c}x/(x − 1): the horizontal asymptote is y = …`, ans: c, tol: 0 }; } ] } },
      qs:[
        { q:"The second derivative locates…", opts:["intercepts","asymptotes","concavity and inflection points","the y-intercept"], a:2, why:"f″ is the bending; where it changes sign the curve inflects." },
        { q:"f(x) = x³ − 3x has a local maximum at x =…", opts:["−1","0","1","3"], a:0, why:"f′ = 3x² − 3 = 0 at ±1; f″(−1) is negative." } ] },
    { n:"4.6", t:"Optimization",
      brief:"Turn the story into a function, fold the constraint in, and the best possible value hides at a critical point. Calculus does the searching; the modelling is on you.",
      key:"One variable, one function, then f′ = 0.",
      full:{
        professor:"Everything so far was practice for today. Optimization is the derivative doing what it was invented for: finding the best — biggest area, cheapest can, shortest route. The calculus is the easy half; the modelling that comes before it is where the thinking lives.",
        objectives:[
          "Translate a word problem into one function of one variable.",
          "Fold the constraint into the objective before differentiating.",
          "Optimize and verify with a derivative test or endpoints." ],
        lecture:[
          ["Before the calculus: the ritual","Read the problem until you can say what is asked in one sentence. Draw a diagram and label it. Give the target quantity a suggestive symbol — A for area, C for cost, t for time — and name every other unknown. This ritual isn't busywork: from Fermat's least-time principle in optics to a farmer's fence, every optimization ever solved began by making the situation speakable."],
          ["Objective and constraint","Every optimization story names two things: what to maximise or minimise (the objective) and what you're stuck with (the constraint). Write both as equations before any calculus — most wrong answers were wrong before the derivative appeared."],
          ["Fold to one variable","Solve the constraint for one variable and substitute into the objective. Two variables become one, and the machinery of 4.2 applies: differentiate, find critical numbers, test them."],
          ["Example — the riverside field","A farmer with 1800 ft of fencing walls off a rectangular field along a straight river, no fence on the river side. Depth x, riverside length y: constraint 2x + y = 1800, objective A = xy. Fold: A(x) = x(1800 − 2x) = 1800x − 2x², on the honest domain 0 ≤ x ≤ 900. A′ = 1800 − 4x = 0 at x = 450; check the short list — A(0) = 0, A(450) = 405,000, A(900) = 0 — and the field is 450 by 900. Note the shape: HALF a square's proportions, because one side came free. Constraints bend optima away from symmetry in exactly the direction of what they give away."],
          ["Trust but verify","A critical number is a candidate, not a verdict. Confirm with the second derivative test — in the field problem A″ = −4 everywhere, one perpetual dome, so the peak is global — or check endpoints if the domain is an interval. A candidate at the domain's edge is disqualified without ceremony."],
          ["The recurring morals","Symmetric problems love symmetric answers: squares beat rectangles, and among all shapes the circle hoards area. When your optimum lands on the symmetric case, that is the mathematics nodding along — and when it lands off-centre, look for the asymmetry in the constraints that pushed it there."] ],
        viz:{ kind:"fence", note:"Forty units of fence: slide the width and watch the area bar peak exactly when the rectangle becomes the 10-by-10 square." },
        worked:{ prompt:"A farmer has 60 m of fence for a rectangular pen against a barn (no fence needed on the barn side). Maximise the area.",
          steps:[
            ["Name and constrain.","Sides w, w and length L along the barn: 2w + L = 60, area A = w·L."],
            ["Fold.","L = 60 − 2w, so A(w) = 60w − 2w²."],
            ["Optimize.","A′ = 60 − 4w = 0 at w = 15, L = 30, area 450 m². Note the asymmetry: the free barn wall changes the answer from a square — constraints shape optima."] ] },
        turn:[
          { q:"Maximise A(x) = 40x − 2x²: the best x is…", type:"num", ans:10, tol:0,
            hint:"A′ = 40 − 4x.",
            work:"x = 10, area 200 — and A″ = −4 confirms a maximum." },
          { q:"Two positive numbers sum to 20. Their product is largest when each is…", type:"num", ans:10, tol:0,
            hint:"Symmetric problem…",
            work:"P = x(20 − x) peaks at x = 10: the symmetric split, product 100." } ],
        homework:{ title:"Homework 4.6 — parameters reshuffle each attempt", gen:[
          () => { const P = 8*(3 + Math.floor(Math.random()*4));
            return { q:`With perimeter ${P}, the largest rectangle area is …`, ans: (P/4)*(P/4), tol: 0 }; },
          () => { const b = 12 + 4*Math.floor(Math.random()*5);
            return { q:`Maximise ${b}x − x²: best x = …`, ans: b/2, tol: 0 }; },
          () => { const S = 2*(6 + Math.floor(Math.random()*7));
            return { q:`Two numbers sum to ${S}; their largest product is …`, ans: (S/2)*(S/2), tol: 0 }; } ] } },
      qs:[
        { q:"The largest rectangular area enclosed by 40 m of fence is…", opts:["64","100","120","160"], a:1, why:"The square wins: 10 × 10." },
        { q:"Minimize x + y given xy = 16 with both positive: the minimum sum is…", opts:["8","10","16","4"], a:0, why:"Symmetry at x = y = 4." } ] },
    { n:"4.7", t:"Optimization in Business and Economics",
      brief:"Profit is revenue minus cost, so profit peaks where their rates agree: marginal revenue equals marginal cost. Every pricing argument in this course is that sentence in costume.",
      key:"P′ = R′ − C′ = 0 at maximum profit.",
      full:{
        professor:"The unit ends where the money is. Every pricing meeting in every firm is, underneath the slides, one calculus sentence: profit peaks where marginal revenue equals marginal cost. Today we earn that sentence and put numbers through it.",
        objectives:[
          "Maximise profit via P′ = R′ − C′ = 0.",
          "Explain MR = MC in one-more-unit language.",
          "Work demand-driven revenue R(x) = x·p(x)." ],
        lecture:[
          ["The cost curve's silhouette","A realistic C(q) starts concave DOWN — early units get cheaper as the line warms up, marginal cost falling — then passes an inflection point and turns concave UP as overtime and bottlenecks bite. That inflection is where 'economies of scale' quietly end. Unit IV's concavity language, reading a factory."],
          ["Example — where average cost bottoms out","Average cost c(q) = C(q)/q has a minimum, and calculus finds it a beautiful home: differentiating C/q by the quotient rule, c′ = 0 exactly when C′(q) = C(q)/q — MARGINAL cost equals AVERAGE cost. Try C(q) = 8000 + 4q + 0.002q²: c(q) = 8000/q + 4 + 0.002q, c′ = −8000/q² + 0.002 = 0 at q = 2000, where c = $12 — and C′(2000) = 4 + 0.004·2000 = $12. The two curves cross exactly at the average's lowest point: while the next unit costs less than the average, it drags the average down; the moment it costs more, it drags it up."],
          ["The one-more-unit argument","If the next unit brings in more than it costs (MR above MC), make it — profit grows. If it costs more than it brings (MC above MR), don't — profit shrinks. The peak sits exactly where the two agree. No graph needed; the economics IS the derivative test."],
          ["Demand bends revenue","You cannot sell unlimited units at one price: demand p(x) falls as quantity rises. Revenue is R(x) = x·p(x) — a parabola-like hill, not a line — and its downhill side is why 'sell more' is not always 'earn more'."],
          ["The full pipeline","From demand p(x) and cost C(x): build R = x·p(x), set R′ = C′, solve for x, then read the price off the demand curve. Four steps from market data to the optimal price tag. The fine print: MR = MC marks a MAXIMUM only when R″ < C″ there — marginal revenue rising slower than marginal cost — which the second derivative test checks in one line."],
          ["Average cost's blind spot","Minimising average cost is NOT maximising profit — average cost ignores revenue entirely. The marginal pair is the only couple that finds the peak; this distinction is a favourite exam ambush."] ],
        viz:{ kind:"marginal", note:"The cost curve's tangent one more time — now imagine a revenue line beside it: profit peaks at the output where the two slopes match." },
        worked:{ prompt:"Demand p(x) = 100 − 2x, cost C(x) = 20x + 50. Find the profit-maximising output and price.",
          steps:[
            ["Build revenue.","R(x) = x·p(x) = 100x − 2x²."],
            ["Set MR = MC.","R′ = 100 − 4x, C′ = 20: 100 − 4x = 20 gives x = 20."],
            ["Price it.","p(20) = 100 − 40 = 60. Twenty units at 60 each; profit R − C = 1200 − 450 = 750, and P″ = −4 confirms the peak."] ] },
        turn:[
          { q:"R′(x) = 80 − 2x and C′(x) = 20: profit peaks at x = …", type:"num", ans:30, tol:0,
            hint:"Set them equal.",
            work:"80 − 2x = 20 at x = 30 — beyond it, each unit costs more than it earns." },
          { q:"At the current output MR is 45 and MC is 52. The firm should…", type:"mc",
            opts:["make more units","make fewer units","hold output","raise fixed costs"], a:1,
            hint:"Is the next unit worth it?",
            work:"The next unit loses 7 — pull back toward where MR meets MC." } ],
        homework:{ title:"Homework 4.7 — parameters reshuffle each attempt", gen:[
          () => { const a = 40 + 20*Math.floor(Math.random()*4), c = 10 + 5*Math.floor(Math.random()*3);
            return { q:`R′ = ${a} − 2x, C′ = ${c}: profit-maximising x = …`, ans: (a - c)/2, tol: 0 }; },
          () => { const b = 30 + 10*Math.floor(Math.random()*4);
            return { q:`R(x) = ${b}x − x²: revenue itself peaks at x = …`, ans: b/2, tol: 0 }; },
          () => { const p0 = 60 + 10*Math.floor(Math.random()*3), d = 2;
            return { q:`p(x) = ${p0} − ${d}x. At x = 10 the price charged is …`, ans: p0 - 10*d, tol: 0 }; } ] } },
      qs:[
        { q:"Profit is maximized where…", opts:["revenue is largest","cost is smallest","marginal revenue equals marginal cost","price equals cost"], a:2, why:"P′ = R′ − C′ = 0." },
        { q:"Revenue R(x) = −x² + 40x is largest at x =…", opts:["10","20","40","80"], a:1, why:"Vertex of the parabola: R′ = −2x + 40 = 0." } ] } ] },
  { title:"Unit V · The Integral", sections:[
    { n:"5.1", t:"Cost, Area and Definite Integrals",
      brief:"Accumulating a rate recovers a total, and the picture of that accumulation is area under the curve. Riemann sums make the idea honest; the integral sign makes it fast.",
      key:"∫ from a to b of f(x) dx is signed area under f.",
      full:{
        professor:"Unit V asks the derivative's question backwards. Instead of 'here is the total, how fast is it changing?' — 'here is the rate, what did it add up to?' The answer turns out to be an area, and the argument for why is one of the great constructions in mathematics.",
        objectives:[
          "Approximate accumulated change with Riemann rectangles.",
          "Explain why refining rectangles converges on the true area.",
          "Interpret the definite integral in applied units." ],
        lecture:[
          ["Accumulating a rate","Fill a tank at exactly 3 L/min for 4 minutes: 12 litres — rate times time, a rectangle's area. A varying rate breaks the shortcut, but not the picture: total accumulated change is still the area under the rate curve."],
          ["Example — costing a run in batches","The café's kombucha line has falling marginal cost per case: $9.00 at the start, then $7.10, $5.80, $5.10, $4.90 after each hundred cases. What did 500 cases cost? Pretend each batch of 100 ran at its STARTING marginal cost: 100·(9.00 + 7.10 + 5.80 + 5.10 + 4.90) = $3190. Pretend instead each ran at its ENDING cost and the same arithmetic gives $2890. The truth sits between the two estimates — and shrinking the batches squeezes the bracket. That squeeze is the whole chapter."],
          ["Rectangles honestly wrong","Slice the interval, pretend the rate is constant on each slice, sum the rectangles. Each is slightly wrong; the sum is roughly right. This is a Riemann sum — a deliberate approximation with an accuracy dial: the number of slices."],
          ["The general recipe","Named in full: split [a, b] into n slices of width Δx = (b − a)/n, sample the function once in each slice — left edge, right edge, midpoint, it won't matter in the end — and total f(x₁)Δx + f(x₂)Δx + … + f(xₙ)Δx. Every accumulation problem in science is this recipe with different nouns."],
          ["Turning the dial to infinity","More slices, less pretending. The sums settle toward one number — a limit, the same move that built the derivative in 2.3. That limit is the definite integral, written ∫ᵃᵇ f(x) dx: the exact area at the end of the rectangles' road. And the sampling choice washes out: left, right and midpoint sums all converge to the same integral."],
          ["Signed, with units","Area below the axis counts negative — outflow against inflow. And units multiply: a rate in L/min integrated over minutes yields litres. The integral's units are always height-units times width-units."] ],
        viz:{ kind:"riemann", note:"Turn the accuracy dial: from 2 clumsy rectangles to 40 fine ones, the total closes in on the exact 8/3 under the parabola." },
        worked:{ prompt:"Estimate the area under f(x) = x² on [0, 2] with 2 midpoint rectangles, then compare with the exact 8/3.",
          steps:[
            ["Slice.","Two slices of width 1: midpoints at 0.5 and 1.5."],
            ["Sum the rectangles.","1·f(0.5) + 1·f(1.5) = 0.25 + 2.25 = 2.5."],
            ["Compare.","Exact: 8/3 ≈ 2.667. Two lazy rectangles already land within 7% — and the dial has only begun to turn."] ] },
        turn:[
          { q:"∫ from 0 to 5 of 4 dx equals…", type:"num", ans:20, tol:0,
            hint:"A constant rate is a rectangle.",
            work:"Height 4, width 5: area 20." },
          { q:"A pump runs at r(t) litres/min. The area under r from t = 0 to t = 30 measures…", type:"mc",
            opts:["the pump's top speed","total litres moved in 30 min","average pressure","the tank's size"], a:1,
            hint:"Accumulated rate is total change.",
            work:"Rate integrated over time is the amount delivered." } ],
        homework:{ title:"Homework 5.1 — parameters reshuffle each attempt", gen:[
          () => { const h = 2 + Math.floor(Math.random()*5), w = 2 + Math.floor(Math.random()*5);
            return { q:`∫ from 0 to ${w} of ${h} dx = …`, ans: h*w, tol: 0 }; },
          () => { const b = 2 + Math.floor(Math.random()*4);
            return { q:`Area of the triangle under y = x from 0 to ${b}: …`, ans: b*b/2, tol: 0.01 }; },
          () => { const a = 1 + Math.floor(Math.random()*3);
            return { q:`One midpoint rectangle for x² on [0, ${2*a}]: width ${2*a} times f(${a}) = …`, ans: 2*a*a*a, tol: 0 }; } ] } },
      qs:[
        { q:"∫ from 0 to 4 of 3 dx equals…", opts:["3","7","12","4/3"], a:2, why:"A 3-by-4 rectangle." },
        { q:"The area under a velocity curve over a time interval measures…", opts:["acceleration","distance travelled","average speed","force"], a:1, why:"Accumulated rate of motion is distance." } ] },
    { n:"5.2", t:"The Fundamental Theorem of Calculus",
      brief:"The theorem that names the course: accumulation and differentiation are inverse operations, so a definite integral is an antiderivative evaluated at the ends.",
      key:"∫ from a to b of f = F(b) − F(a), where F′ = f.",
      full:{
        professor:"Today the two halves of the course shake hands. Derivatives measured change; integrals accumulate it — and the Fundamental Theorem says they are inverse operations. The rectangle-limit of 5.1 collapses into two evaluations of an antiderivative. It is the biggest bargain in mathematics.",
        objectives:[
          "Find antiderivatives by running the power rule backwards.",
          "Evaluate definite integrals as F(b) − F(a).",
          "State why accumulation and differentiation undo each other." ],
        lecture:[
          ["The area function's secret","Let A(x) be the area under f collected so far. Nudge x forward by dx and the area gains a sliver — height f(x), width dx. So A grows at rate f(x): the area function's DERIVATIVE is the curve itself. Accumulation and differentiation are one machine, run in opposite directions."],
          ["Antiderivatives","An antiderivative of f is any F with F′ = f. Power rule backwards: raise the power by one, divide by the new power. xⁿ ↦ xⁿ⁺¹/(n + 1), plus a constant C the derivative can't see. So t⁴ antidifferentiates to t⁵/5 + C — and checking is always available: differentiate your answer and the original function must reappear, exactly."],
          ["The awkward exception","The backwards power rule divides by n + 1, which explodes at n = −1. So who antidifferentiates 1/x? An old acquaintance: (ln|x|)′ = 1/x from 3.5, so ∫ (1/x) dx = ln|x| + C — the absolute value earning its keep by covering negative x. The one hole in the power-rule family is patched by the logarithm; nothing in the toolkit goes to waste."],
          ["The theorem at work","∫ᵃᵇ f dx = F(b) − F(a): total accumulation is the antiderivative's net rise. No rectangles, no limits — two substitutions and a subtraction settle what 5.1 needed infinitely many slices to approach."],
          ["Example — the bargain, itemised","∫₀¹ x² dx: an antiderivative of x² is x³/3 (differentiate to check: 3x²/3 = x² ✓). Write the evaluation bar [x³/3]₀¹ = 1/3 − 0 = 1/3. Done — the exact area under the parabola that 5.1's forty rectangles could only crowd toward, purchased with one antiderivative and a subtraction. The bracket-with-limits notation is the standard bookkeeping; adopt it."],
          ["Why C never matters here","Any antiderivative works: shift F up by C and both F(b) and F(a) shift together, cancelling in the difference. The constant matters for indefinite integrals; the definite kind is immune."] ],
        viz:{ kind:"accum", note:"Watch the handshake live: the shaded area-so-far grows exactly at the curve's own height — A′(x) = f(x), the Fundamental Theorem in one picture." },
        worked:{ prompt:"Evaluate ∫ from 1 to 3 of (3x² + 2) dx.",
          steps:[
            ["Antidifferentiate.","3x² ↦ x³ and 2 ↦ 2x, so F(x) = x³ + 2x."],
            ["Evaluate at the ends.","F(3) = 27 + 6 = 33; F(1) = 1 + 2 = 3."],
            ["Subtract.","33 − 3 = 30 — the exact area, no rectangle ever drawn."] ] },
        turn:[
          { q:"∫ from 0 to 3 of x² dx equals…", type:"num", ans:9, tol:0,
            hint:"Antiderivative x³/3, then evaluate.",
            work:"27/3 − 0 = 9." },
          { q:"An antiderivative of x⁴ is…", type:"mc",
            opts:["4x³","x⁵/5","x⁴/4","5x⁵"], a:1,
            hint:"Raise the power, divide by the new one.",
            work:"d/dx (x⁵/5) = x⁴ — check by differentiating, always." } ],
        homework:{ title:"Homework 5.2 — parameters reshuffle each attempt", gen:[
          () => { const b = 1 + Math.floor(Math.random()*4);
            return { q:`∫ from 0 to ${b} of 2x dx = …`, ans: b*b, tol: 0 }; },
          () => { const b = 1 + Math.floor(Math.random()*3);
            return { q:`∫ from 0 to ${b} of 3x² dx = …`, ans: b*b*b, tol: 0 }; },
          () => { const c = 2 + Math.floor(Math.random()*6), w = 1 + Math.floor(Math.random()*4);
            return { q:`∫ from 0 to ${w} of ${c} dx = …`, ans: c*w, tol: 0 }; } ] } },
      qs:[
        { q:"∫ from 0 to 2 of 2x dx equals…", opts:["2","4","8","x²"], a:1, why:"F(x) = x²; F(2) − F(0) = 4." },
        { q:"The Fundamental Theorem links…", opts:["limits and continuity","differentiation and integration","slopes and asymptotes","area and volume"], a:1, why:"Each undoes the other." } ] },
    { n:"5.3", t:"The Net Change Theorem and Average Value",
      brief:"Integrating a rate of change gives the net change — the odometer reading of any process. Divide an integral by its interval and you get the function's honest average.",
      key:"Average value = (1/(b − a)) · ∫ from a to b of f.",
      full:{
        professor:"Two corollaries of the Fundamental Theorem earn their own lecture because applications lean on them daily. The net change theorem is the odometer principle — integrate a rate, get the total change. And the average of a whole continuous curve turns out to be one integral divided by one width.",
        objectives:[
          "Apply the net change theorem to rates in context.",
          "Compute the average value of a function on an interval.",
          "Distinguish net change from total distance when rates go negative." ],
        lecture:[
          ["The odometer principle","F′ integrated over [a, b] is F(b) − F(a): integrate a rate of change and you recover the net change. Population growth rates give population gained; marginal cost integrated from 100 to 200 units gives the cost of that production run."],
          ["One theorem, every costume","Read the same equation in four vocabularies. Marginal cost: ∫ C′(q) dq from q₁ to q₂ is the cost of raising production from q₁ to q₂. Reservoir: ∫ V′(t) dt is the water gained between two times. Motion: ∫ v(t) dt is displacement — where you ended up. Ecology, finance, medicine: any derivative you meet, its integral over an interval is the net change of the parent quantity. One theorem; the nouns rotate."],
          ["Net is not gross","A rate that dips negative — water draining, a car reversing — subtracts from the net. The integral reports where you ENDED relative to where you started; total activity (distance travelled, water moved) integrates the rate's absolute value instead. Say which one the question asked."],
          ["Example — displacement versus distance","v(t) = t − 2 m/s on [0, 3]: the walker backs up for two seconds, then advances. Net: ∫₀³ (t − 2) dt = [t²/2 − 2t]₀³ = −1.5 — they END 1.5 m behind their start. Distance: integrate the SPEED |v|: the backward triangle holds 2 m and the forward one 0.5 m, total 2.5 m walked. Two honest answers to two different questions, and the sign of v is what separates them."],
          ["The honest average","Average of finitely many numbers: sum over count. Average of a continuum: integral over width, (1/(b − a))·∫ᵃᵇ f. It is the height of the rectangle with the same area as the curve — the level the lake would settle at."],
          ["Averages meet marginals","A firm's average cost per unit over a production run is the integral of marginal cost over the run, divided by its width — 3.2's marginal and today's average, finally in one formula."] ],
        viz:{ kind:"accum", note:"The area accumulates; now imagine flattening that shaded region into a rectangle of the same width — its height is the function's average value." },
        worked:{ prompt:"v(t) = 6t litres/min fills a tank. Net change from t = 0 to 4, and the average fill rate?",
          steps:[
            ["Net change.","∫₀⁴ 6t dt = 3t² evaluated: 48 litres entered."],
            ["Average rate.","48 / (4 − 0) = 12 litres/min."],
            ["Sanity.","The rate climbed steadily 0 → 24; halfway, 12, matches the average exactly — linear rates make the midpoint the mean."] ] },
        turn:[
          { q:"The average value of f(x) = x² on [0, 3] is…", type:"num", ans:3, tol:0,
            hint:"Integral 9 (from last lecture), then divide by the width.",
            work:"9/3 = 3 — the parabola's fair height on that stretch." },
          { q:"P′(t) integrated from 2010 to 2020 gives…", type:"mc",
            opts:["the population in 2020","the population gained over the decade","the average population","the growth rate in 2020"], a:1,
            hint:"Integrated rate = net change.",
            work:"P(2020) − P(2010): the decade's net gain, not any single year's headcount." } ],
        homework:{ title:"Homework 5.3 — parameters reshuffle each attempt", gen:[
          () => { const b = 2*(1 + Math.floor(Math.random()*3));
            return { q:`Average value of f(x) = x on [0, ${b}] = …`, ans: b/2, tol: 0 }; },
          () => { const k = 2 + Math.floor(Math.random()*4), b = 2 + Math.floor(Math.random()*3);
            return { q:`v(t) = ${2*k}t. Net change from 0 to ${b} = …`, ans: k*b*b, tol: 0 }; },
          () => { const c = 3 + Math.floor(Math.random()*6);
            return { q:`Average value of the constant f(x) = ${c} on ANY interval = …`, ans: c, tol: 0 }; } ] } },
      qs:[
        { q:"The average value of f(x) = x on [0, 4] is…", opts:["1","2","4","8"], a:1, why:"(1/4)·(16/2) = 2." },
        { q:"If r(t) is the flow into a tank in litres/min, ∫ from 0 to 10 of r dt is…", opts:["the flow rate at t = 10","the average flow","the total litres added in 10 minutes","the tank's capacity"], a:2, why:"Integrated rate is net change in volume." } ] },
    { n:"5.4", t:"The Substitution Rule",
      brief:"Substitution is the chain rule run backwards: name the inside function u, trade dx for du, and a disguised power rule steps out of costume.",
      key:"Choose u so that du is already standing next to it in the integrand.",
      full:{
        professor:"The chain rule made composites easy to differentiate; substitution makes their integrals possible. The method is a change of costume: name the inner function u, translate everything into u's language, and a monster becomes a power rule. Recognising WHO should be u is the entire art.",
        objectives:[
          "Choose u so that du already sits in the integrand.",
          "Run the full substitution, including changing dx to du.",
          "Adjust for missing constant factors honestly." ],
        lecture:[
          ["Reading the chain rule backwards","The chain rule produces integrands shaped like f(inner)·inner′. Substitution spots that fingerprint: if the derivative of one part is standing beside it, the pair collapses to ∫ f(u) du."],
          ["The mechanics","Set u = inner, compute du = u′ dx, and rewrite EVERYTHING — no x may survive into u-land. Integrate the simpler ∫ in u, then translate back. Half-finished substitutions, with x and u mingling, are the topic's classic wreckage."],
          ["Constants are negotiable","∫ x·e^(x²) dx wants du = 2x dx but only x dx is present. Fine: x dx = du/2, and the ½ rides outside the integral. Missing constants are repairable; missing FUNCTIONS are not — if u′ isn't there up to a constant, substitution is the wrong tool."],
          ["Example — a repair in full","∫ x²(x³ + 5)⁴ dx: choose u = x³ + 5, since its derivative 3x² is loitering out front up to a factor. Then du = 3x² dx, so x² dx = du/3, and the integral becomes (1/3)∫ u⁴ du = u⁵/15 + C = (x³ + 5)⁵/15 + C. Every symbol translated, the constant repaired, the answer returned to x's language — the complete ritual in five moves."],
          ["Definite integrals move their limits","For ∫ᵃᵇ, translate the endpoints too: x = a becomes u(a), x = b becomes u(b), and there is no translating back — finish entirely in u. Cleaner, and one fewer place to slip."],
          ["Symmetry does some integrals for free","On a symmetric interval [−a, a]: an EVEN function (f(−x) = f(x)) doubles its right half, ∫ = 2∫₀ᵃ. An ODD one (f(−x) = −f(x)) cancels itself entirely: ∫ = 0. So ∫ from −2 to 2 of x⁵/(1 + x²) dx is zero — odd over even is odd — and no antiderivative was ever found. Check symmetry BEFORE computing; the fastest integral is the one you don't do."] ],
        viz:{ kind:"chain", note:"The same gears as 3.4, now run backwards: the readout's inner-rate factor is exactly the du the substitution needs to find in the integrand." },
        worked:{ prompt:"Evaluate ∫ 2x(x² + 1)³ dx.",
          steps:[
            ["Spot the pair.","Inner function x² + 1; its derivative 2x stands right beside the power. The fingerprint is complete."],
            ["Translate.","u = x² + 1, du = 2x dx: the integral becomes ∫ u³ du."],
            ["Power rule and return.","u⁴/4 + C = (x² + 1)⁴/4 + C. Differentiate it back — the chain rule regurgitates the original, which is the whole point."] ] },
        turn:[
          { q:"For ∫ x²·(x³ + 5)⁴ dx, the right u is…", type:"mc",
            opts:["x²","x³ + 5","(x³ + 5)⁴","x³"], a:1,
            hint:"Whose derivative (up to a constant) is sitting in front?",
            work:"u = x³ + 5 has du = 3x² dx, and x² dx = du/3 — the pair collapses." },
          { q:"With u = x² + 1, the integral ∫ 2x(x² + 1)³ dx evaluated from x = 0 to x = 1 equals… (using u-limits 1 to 2)", type:"num", ans:3.75, tol:0.01,
            hint:"∫₁² u³ du = u⁴/4 between 1 and 2.",
            work:"16/4 − 1/4 = 3.75 — limits translated, never back to x." } ],
        homework:{ title:"Homework 5.4 — parameters reshuffle each attempt", gen:[
          () => { const n = 2 + Math.floor(Math.random()*3);
            return { q:`∫ 2x(x² + 1)${n === 2 ? "²" : "³"} dx = (x² + 1)^${n+1}/${n+1} + C. At x = 1 that antiderivative equals…`, ans: Math.pow(2, n+1)/(n+1), tol: 0.01 }; },
          () => { const k = 2 + Math.floor(Math.random()*4);
            return { q:`For ∫ x·e^(${k}x²) dx with u = ${k}x², x dx = du divided by …`, ans: 2*k, tol: 0 }; },
          () => { const a = 1 + Math.floor(Math.random()*3);
            return { q:`∫ from 0 to ${a} of 2x·1 dx (u = x², straight power) = …`, ans: a*a, tol: 0 }; } ] } },
      qs:[
        { q:"∫ 2x(x² + 1)³ dx equals…", opts:["(x² + 1)⁴/4 + C","(x² + 1)³/3 + C","2(x² + 1)⁴ + C","x²(x² + 1)³ + C"], a:0, why:"u = x² + 1, du = 2x dx." },
        { q:"For ∫ x·e^(x²) dx the right substitution is u =…", opts:["x","eˣ","x²","e^(x²)"], a:2, why:"du = 2x dx matches the loose x dx." } ] },
    { n:"5.5", t:"Integration by Parts", bridge:"MATH 202",
      brief:"The product rule, integrated and rearranged: trade one integral for a hopefully easier one. Choosing which factor to differentiate is the whole art.",
      key:"∫ u dv = u·v − ∫ v du.",
      full:{
        professor:"The bridge lecture. Substitution reversed the chain rule; integration by parts reverses the product rule — and it is the doorway to Calculus II, where it becomes a daily tool. Cross it here and MATH 202 will greet you like a returning friend.",
        objectives:[
          "Derive the parts formula from the product rule.",
          "Choose u to differentiate and dv to integrate wisely.",
          "Evaluate the classic ∫ x·eˣ dx family." ],
        lecture:[
          ["The product rule, integrated","(uv)′ = u′v + uv′. Integrate both sides and rearrange: ∫ u dv = uv − ∫ v du. Parts doesn't finish the job — it trades your integral for a different one, and the game is trading down."],
          ["Choosing sides","Pick u to be the factor that IMPROVES when differentiated (x becomes 1 — wonderful), and dv the factor you can integrate without tears (eˣ — free). Choose backwards and the trade goes uphill: the new integral is worse than the old."],
          ["The classic run","∫ x·eˣ dx: u = x, dv = eˣ dx gives x·eˣ − ∫ eˣ dx = eˣ(x − 1) + C. One trade, done. Polynomials times exponentials all fall this way, one degree per trade — and the check is always free: differentiate eˣ(x − 1) and the product rule hands back x·eˣ."],
          ["Example — trading twice","∫ t²·eᵗ dt needs two rounds: u = t² dies to 2t on the first trade — t²eᵗ − 2∫ t·eᵗ dt — and the leftover is the classic, falling on the second: t²eᵗ − 2eᵗ(t − 1) = eᵗ(t² − 2t + 2) + C. The strategy generalises: tⁿ takes n trades, the exponential absorbing each one unchanged. Choose u as the factor that IMPROVES; eᵗ never improves and never worsens — the perfect trading partner."],
          ["Why this is the bridge","Chapter 6's applications — consumer surplus, present value of income streams, probability densities — integrate exactly these products. Parts is the last tool in the Calculus I kit and the first one Calculus II reaches for."] ],
        viz:{ kind:"prodrect", note:"The product rule's rectangle once more: parts is that picture read backwards — the whole area uv, minus the strip you can still integrate." },
        worked:{ prompt:"Evaluate ∫ x·e^(2x) dx.",
          steps:[
            ["Choose sides.","u = x (differentiates to 1), dv = e^(2x) dx (integrates to e^(2x)/2)."],
            ["Trade.","x·e^(2x)/2 − ∫ e^(2x)/2 dx."],
            ["Finish the easier one.","x·e^(2x)/2 − e^(2x)/4 + C = (e^(2x)/4)(2x − 1) + C — differentiate to verify, and it folds back perfectly."] ] },
        turn:[
          { q:"For ∫ x·eˣ dx, the wise u is…", type:"mc",
            opts:["eˣ","x","x·eˣ","dx"], a:1,
            hint:"Which factor improves under differentiation?",
            work:"u = x dies to 1 in one step; eˣ integrates for free as dv." },
          { q:"∫ from 0 to 1 of x·eˣ dx = eˣ(x − 1) evaluated = … (2 decimals)", type:"num", ans:1, tol:0.01,
            hint:"At 1: e·0 = 0. At 0: 1·(−1) = −1.",
            work:"0 − (−1) = 1 — exactly one, from the bridge's classic." } ],
        homework:{ title:"Homework 5.5 — parameters reshuffle each attempt", gen:[
          () => { const k = 1 + Math.floor(Math.random()*3);
            return { q:`∫ x·eˣ dx = eˣ(x − 1) + C. Its value at x = ${k} minus its value at 0 (2 decimals): …`, ans: +((Math.exp(k)*(k-1)) - (-1)).toFixed(2), tol: 0.05 }; },
          () => { return { q:`∫ x·eˣ dx = eˣ(x − 1) + C. The antiderivative's value at x = 0 is …`, ans: -1, tol: 0 }; },
          () => { const n = 2 + Math.floor(Math.random()*3);
            return { q:`∫ xⁿ·eˣ dx needs how many parts-trades for n = ${n}?`, ans: n, tol: 0 }; } ] } },
      qs:[
        { q:"∫ x·eˣ dx equals…", opts:["x·eˣ + C","eˣ(x − 1) + C","x²eˣ/2 + C","eˣ + C"], a:1, why:"u = x, dv = eˣ dx gives x·eˣ − eˣ." },
        { q:"For ∫ x·cos x dx, the wise choice of u is…", opts:["cos x","x","x·cos x","sin x"], a:1, why:"Differentiating x kills it; integrating cos x is free." } ] } ] } ] },
};

export { STUDY };
