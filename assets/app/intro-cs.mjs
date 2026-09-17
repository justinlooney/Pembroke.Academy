/** Original introductory material. Reference: Python's official language tutorial. */
const num = (q, ans, work, hint = "Trace each statement in order, keeping a table of the variables.") => ({ q, type: "num", ans, tol: 0, hint, work });
const viz = trace => ({ kind: "pythontrace", trace, note: "Drag the control to step through this fixed Python program. Predict the next state before moving. This is a teaching trace, not an editable Python interpreter." });
const sources = '<a href="https://docs.python.org/3/tutorial/introduction.html">Python tutorial: expressions and values</a> · <a href="https://docs.python.org/3/tutorial/controlflow.html">Python tutorial: control flow and functions</a>';
export const INTRO_CS = {
  lectures: "Unit I is available: four lessons on Python expressions, decisions, loops and functions. Later programming units are not yet available; this is not the full course.",
  grading: [["Knowledge checks", "quizzes", 60], ["Homework", "homework", 30], ["Interactive labs", "labs", 10]],
  units: [{ title: "Unit I · Think like a programmer", sections: [
    { n: "1.1", t: "Values, variables and a changing state",
      brief: "A program is a sequence of precise instructions. Start by predicting how each instruction changes the values in memory, rather than guessing what the whole program does.",
      key: "Assignment evaluates the right-hand expression now, then binds the name on the left to that result.",
      full: {
        professor: "Welcome to the programming studio. You do not need previous coding experience. Your first tool is a state table: one row per executed statement, one column per variable. Being able to explain a short program is more valuable than typing a long one you cannot check.",
        objectives: ["Trace assignments without confusing them with algebraic equality.", "Evaluate arithmetic expressions in Python's order of operations.", "Distinguish a stored value from a formula that recomputes itself."],
        lecture: [
          ["Expressions produce values", "In Python, <code>2 + 3 * 4</code> evaluates to 14; <code>(2 + 3) * 4</code> evaluates to 20. An integer such as 7 is different from a string such as <code>'7'</code>. Keep the type in mind: numeric addition and joining strings are different operations. <code>7 / 2</code> gives 3.5, while <code>7 // 2</code> gives 3. For negative numbers, floor division rounds down, not toward zero."],
          ["A name refers to a value", "After <code>x = 4</code>, the name x refers to 4. The next statement, <code>x = x + 2</code>, first reads the old x, computes 6, then binds x to 6. This is an update, not the impossible algebraic equation x = x + 2. Using a name before it is assigned raises an error."],
          ["Snapshots, not live equations", "Run <code>hours = 3</code> and then <code>cost = hours * 8</code>. The value stored in cost is 24. Updating hours to 4 does not change cost. To calculate the new cost you must execute the calculation again. This distinction is essential when a simulation or a campus character updates each frame."],
          ["Practice beyond the trace", "Write a three-line price calculation on paper. Predict every intermediate value, then run it in a Python 3 interpreter if one is available. Change a variable only after computing the total: can you explain why the old total stays? Reference: " + sources]
        ],
        viz: viz("assignment"),
        worked: { prompt: "Trace x = 5; y = x * 2; x = x + 3. What are x and y at the end?", steps: [["Bind the first name.", "x is 5."], ["Evaluate the multiplication now.", "y becomes 10."], ["Update x, not y.", "x becomes 8; y remains 10. There is no automatic link between the two names."]] },
        turn: [num("After a = 6; b = a + 4; a = 2, what is b?", 10, "b was assigned 10 before a changed."), num("What is the value of 3 + 2 * 5?", 13, "Multiplication first: 3 + 10 = 13.")],
        homework: { title: "State-table practice", gen: [() => num("After n = 4; n = n * n; n = n - 1, what is n?", 15, "4 → 16 → 15."), () => num("Evaluate (9 + 3) // 2.", 6, "12 // 2 = 6.")] }
      },
      qs: [{ q: "After x = 2; y = x + 1; x = 9, what is y?", opts: ["3", "10", "An error"], a: 0, why: "The expression for y was evaluated when x was 2." }, { q: "What does x = x + 1 do when x is 4?", opts: ["Proves 4 equals 5", "Binds x to 5", "Changes every expression using x"], a: 1, why: "The old value is read before the new value is assigned." }, { q: "Which expression evaluates to 14?", opts: ["(2 + 3) * 4", "2 + 3 * 4", "2 * 3 + 4"], a: 1, why: "3 * 4 is evaluated before adding 2." }]
    },
    { n: "1.2", t: "Decisions and boundary cases",
      brief: "A conditional chooses which instructions execute. Good programmers check not only typical inputs, but also the exact boundary where the decision changes.",
      key: "An if/else executes one branch. Test below, at and above a threshold.",
      full: {
        professor: "Imagine deciding whether a learner can enter a lab. A rule that is almost right can reject exactly the learner at the cutoff. Name the condition precisely and test its boundary before trusting it.",
        objectives: ["Evaluate comparisons and follow an if/else.", "Distinguish assignment (=) from equality comparison (==).", "Choose boundary tests that reveal a wrong comparison operator."],
        lecture: [["Conditions have truth values", "The comparison <code>score &gt;= 6</code> is True at 6 and 7, and False at 5. The operator <code>==</code> compares values; <code>=</code> assigns a name. To require two conditions, combine them with <code>and</code>. Use <code>or</code> when either is sufficient."],
          ["Indentation defines the branch", "In <code>if score &gt;= 6:</code>, the indented statements beneath it run only when the condition is true. An associated <code>else:</code> runs only when it is false. The program then continues after the whole conditional. Two separate if statements are not the same as an if/else pair: both independent conditions can be true."],
          ["Test the dividing line", "For an inclusive cutoff of 6, the inputs 5, 6 and 7 should yield reject, accept and accept. Testing only 2 and 10 would not detect accidentally writing &gt; instead of &gt;=. In a real application also define valid input types and allowed ranges; a passing comparison alone does not validate an input."],
          ["Make the specification explicit", "Write a rule for a campus workshop requiring at least 3 completed exercises and fewer than 20 attendees. State which comparisons are inclusive. Build a small input/output table before writing code. Reference: " + sources]],
        viz: viz("branch"),
        worked: { prompt: "A discount applies when quantity >= 10. Choose three tests around the cutoff.", steps: [["Test just below.", "9 must not receive the discount."], ["Test exactly at the boundary.", "10 must receive it. This distinguishes >= from >."], ["Test just above.", "11 must receive it. All three together describe the transition."]] },
        turn: [num("A program sets result = 1 if score >= 6, else result = 0. For score = 6, what is result?", 1, "Equality is included in >=."), num("For score = 5 in the same program, what is result?", 0, "5 >= 6 is false, so the else branch assigns 0.")],
        homework: { title: "Boundary-testing practice", gen: [() => num("Set fee = 0 if age < 5, else fee = 8. What is fee at age = 5?", 8, "5 is not less than 5."), () => num("Set ready = 1 if count >= 3 and count <= 5, else 0. What is ready at count = 6?", 0, "6 fails the upper bound.")] }
      },
      qs: [{ q: "Which input detects a mistaken > in place of >= 6?", opts: ["0", "6", "10"], a: 1, why: "Only the boundary has different outcomes for these two operators." }, { q: "How many branches execute in an if/else?", opts: ["Both", "Exactly one", "Always zero"], a: 1, why: "The condition selects one branch, then control continues after the conditional." }, { q: "Which compares x with 3?", opts: ["x = 3", "x == 3", "x + 3"], a: 1, why: "== is equality comparison; = is assignment." }]
    },
    { n: "1.3", t: "Loops, accumulation and invariants",
      brief: "A loop repeats a small, explainable step. An accumulator carries a result from one iteration to the next; an invariant tells you what that result means throughout the loop.",
      key: "Initialize once before the loop. After each iteration, total is the sum of the values processed so far.",
      full: {
        professor: "Do not memorize a loop as a spell. Explain the state before it begins, how one iteration changes that state, and why the loop eventually stops. Those three questions scale from adding numbers to analyzing algorithms.",
        objectives: ["List the values produced by a positive-step range.", "Trace an accumulator without resetting it inside the loop.", "Use an invariant and the empty case to explain a loop's result."],
        lecture: [["Ranges stop before the endpoint", "The loop <code>for n in range(1, 4):</code> visits 1, 2 and 3, in that order. The starting value is included and the stopping value is excluded. With no explicit start, <code>range(4)</code> visits 0, 1, 2, 3. An empty range such as <code>range(1, 1)</code> executes the body zero times."],
          ["Carry the result forward", "Set <code>total = 0</code> before the loop. In its body, execute <code>total = total + n</code>. For 1, 2, 3 the successive totals are 1, 3 and 6. If total were reset to zero inside the body, earlier contributions would be lost. Initialization belongs outside because it describes the state before any values have been processed."],
          ["A small correctness argument", "Before the first iteration total is 0, the sum of no values. If total correctly sums the processed values, adding the next n makes it correctly sum one more. When the finite range is exhausted, all values have been processed. This invariant explains the final answer and the empty case; testing a few examples alone is not a proof for every input."],
          ["Count the work", "A loop with N iterations and a fixed amount of work per iteration takes work proportional to N in a simple operation-count model. Nesting another N-iteration loop can instead create N² repetitions. We will study this distinction in later units. For now, trace both a one-element and an empty range. Reference: " + sources]],
        viz: viz("loop"),
        worked: { prompt: "Start total = 0. Add n for each n in range(2, 5).", steps: [["List the inputs.", "2, 3, 4. The stop value 5 is excluded."], ["Update the running total.", "After 2: total = 2. After 3: total = 5. After 4: total = 9."], ["Check the invariant.", "At every step total equals the sum of the numbers already visited. At termination it is 2 + 3 + 4 = 9."]] },
        turn: [num("What is the sum accumulated from range(1, 5), starting at 0?", 10, "1 + 2 + 3 + 4 = 10."), num("How many times does range(2, 6) run a for-loop body?", 4, "It yields 2, 3, 4, 5.")],
        homework: { title: "Loop reasoning", gen: [() => num("Start total = 0 and add n for each n in range(3, 6). What is total?", 12, "3 + 4 + 5 = 12."), () => num("Start total = 0 and add n for range(1, 1). What is total?", 0, "No iterations run, so the initial value remains.")] }
      },
      qs: [{ q: "Which values are in range(1, 4)?", opts: ["1, 2, 3, 4", "0, 1, 2, 3", "1, 2, 3"], a: 2, why: "The stop value is excluded." }, { q: "Where should a sum accumulator be initialized?", opts: ["Once before the loop", "At the start of every iteration", "Only after the loop"], a: 0, why: "Resetting it in the body discards earlier contributions." }, { q: "What does the invariant total = sum of processed values explain?", opts: ["Only one test input", "Why each update preserves the meaning of total", "That the loop runs instantly"], a: 1, why: "Initialization and preservation together justify the final result when the loop terminates." }]
    },
    { n: "1.4", t: "Functions, contracts and useful tests",
      brief: "A function packages a computation behind a name and an input/output agreement. Separate returning a useful value from printing something for a person to read.",
      key: "Parameters are local to a call. return hands a value to the caller; print alone does not.",
      full: {
        professor: "Now make your code reusable. A good function has a purpose you can state in one sentence, inputs you understand and a result you can test independently. Small functions let us reason about a large system in manageable pieces.",
        objectives: ["Trace a call, its local parameter and its return value.", "Distinguish return from print and identify the implicit None result.", "Design representative and boundary tests for a simple contract."],
        lecture: [["Definition is not execution", "The definition <code>def square(x):</code> introduces a function whose indented body is <code>return x * x</code>. Defining it does not yet multiply any values. Calling <code>square(3)</code> binds its local parameter x to 3 and computes 9. A later call with 4 has its own local x and returns 16."],
          ["Return a value the caller can use", "In <code>a = square(3)</code>, the caller assigns the returned 9 to a. You can compose results, for example <code>square(3) + square(4)</code>. A function that only calls print displays text but, without an explicit return value, returns <code>None</code>. Display and computation are different responsibilities."],
          ["Write a contract", "For this exercise, square accepts an integer and returns its product with itself. Our tests should include 0, a positive integer and a negative integer. Expected results for 0, 3 and −3 are 0, 9 and 9. The contract deliberately excludes strings and arbitrary objects; define support for other types explicitly before relying on it."],
          ["A first independent task", "On paper or in Python 3, define <code>rental_cost(hours)</code> returning a fixed fee of 10 plus 6 per hour, for nonnegative integer hours. Check 0 → 10, 1 → 16 and 3 → 28. Explain what your function should do for an invalid input before adding validation. Passing these tests gives evidence, not a guarantee for every possible program. Reference: " + sources]],
        viz: viz("function"),
        worked: { prompt: "A function double(x) returns 2 * x. Trace a = double(3); b = double(a).", steps: [["Make the first call.", "Its local x is 3, so it returns 6. The caller assigns a = 6."], ["Pass the result to a new call.", "double(a) receives 6, so its local x is 6 and it returns 12."], ["State the caller's final values.", "a = 6 and b = 12. Neither call leaves a global x behind."]] },
        turn: [num("square(x) returns x * x. What is square(2) + square(5)?", 29, "4 + 25 = 29."), num("rental_cost(h) returns 10 + 6 * h. What does rental_cost(2) return?", 22, "10 + 12 = 22.")],
        homework: { title: "Function contracts", gen: [() => num("square(x) returns x * x. What is square(-4)?", 16, "(-4) * (-4) = 16."), () => num("double(x) returns 2 * x. What is double(double(3))?", 12, "The inner call returns 6; the outer call returns 12.")] }
      },
      qs: [{ q: "When does a function body run?", opts: ["Only when the file is named", "When the function is called", "Whenever any variable changes"], a: 1, why: "Defining a function prepares it; calling it executes the body." }, { q: "What does a function with only print(9) return?", opts: ["9", "The string '9'", "None"], a: 2, why: "Without an explicit return value, Python returns None." }, { q: "Which tests best probe square on integers?", opts: ["Only 3", "0, 3 and −3", "No tests if its name looks right"], a: 1, why: "Zero, positive and negative inputs exercise distinct cases within the contract." }]
    }
  ] }]
};
