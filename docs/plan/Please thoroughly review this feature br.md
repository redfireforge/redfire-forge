Please thoroughly review this feature branch and if there is any monorithic class and requires refactoring and make module for common codes, please do. Treat any existing code is your code. If you find any above, please fix them, too. And please remove redundant codes and make module. And add unit tests and E2E tests. Also these tests code quality is very important. It expects code coverage over 90 %. Let's called monorithic class definition has over 900 lines. Repeat serveral rounds until you don't find any issue. Make sure you should not break any existing logic. And alwasy show max lines for 10 classes and lowest 10 code coverage codes. 
Don't ignore any existing bug for unit tests and E2E tests with 30 seconds timeout. Fix them before moving on to the next step. And always show max lines for 10 classes and lowest 10 code coverage codes. If not satisfy, repeat the process. Also fix eslint issues. 
Please always run E2E with report so that I can see progress. Keep in mind. 

--------------------------------------------------------------------------


Thoroughly re-evaluate what are missing or if there are any bugs in any phase , update or fix all of them.  Then let's implement 3F

What is next phase? Do we have detail sub-phases? Also througly search if we need any additonal things overall? 


Please start with a thorough audit of all previously completed phases from the phase 1 to find any bugs, gaps, or inconsistencies before proceeding with the 11C implementation. You don't need to run E2E tests for this. 


When you implement ui, pleaes data-mapper-edge-cases-mockup.html mockup for reference.
Make sure to follow the mockup design as your reference.


--------------------------------------------------------------------------
File	New Tests	Coverage Before → After
DataMapper.test.tsx
12 tests (error popover, resize handles, array suggestion bar, deserialize error, repairTick)
79.78% → 81.13% stmts
DataMapperModal.test.tsx
10 tests (serialize throw, validate throw, Escape handling, fullscreen, required fields, custom doneLabel)
80.3% stmts (test refs fixed)
ExpressionEditorModal.test.tsx
8 tests (Ctrl+Enter, Escape, function insert fallback, step debugger toggle, sourcePath default)
81.32% stmts