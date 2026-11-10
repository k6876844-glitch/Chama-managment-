const { Router } = require('express');
const { authenticate, authorize } = require('./middleware/auth');
const { OFFICIALS } = require('./utils/helpers');

const auth = require('./controllers/auth.controller');
const members = require('./controllers/members.controller');
const contributions = require('./controllers/contributions.controller');
const loans = require('./controllers/loans.controller');
const fines = require('./controllers/fines.controller');
const expenses = require('./controllers/expenses.controller');
const meetings = require('./controllers/meetings.controller');
const reports = require('./controllers/reports.controller');

// All routes and the roles allowed on each are listed here, so the access
// rules can be read in one place (see docs/api.md).
const r = Router();

const officials = authorize(...OFFICIALS);
const chairperson = authorize('chairperson');
const treasurer = authorize('treasurer');
const secretary = authorize('secretary');
const chairOrSecretary = authorize('chairperson', 'secretary');

r.post('/auth/login', auth.login);
r.post('/auth/register', auth.register); // self sign-up, always as an ordinary member

r.use(authenticate); // everything below needs a logged-in member

r.get('/auth/me', auth.me);
r.post('/auth/logout', auth.logout);

r.get('/members', officials, members.list);
r.get('/members/:id', members.show); // controller allows self
r.post('/members', chairOrSecretary, members.create);
r.put('/members/:id', chairOrSecretary, members.update);
r.delete('/members/:id', chairperson, members.deactivate);

r.get('/contributions', contributions.list);
r.post('/contributions', authorize('treasurer', 'chairperson'), contributions.create);
r.put('/contributions/:id', treasurer, contributions.update);
r.delete('/contributions/:id', treasurer, contributions.remove);

r.get('/loans', loans.list);
r.get('/loans/:id', loans.show);
r.post('/loans', loans.apply);
r.patch('/loans/:id/approve', chairperson, loans.approve);
r.patch('/loans/:id/reject', chairperson, loans.reject);
r.post('/loans/:id/repayments', treasurer, loans.repay);

r.get('/fines', fines.list);
r.post('/fines', authorize('treasurer', 'secretary'), fines.create);
r.patch('/fines/:id/pay', treasurer, fines.pay);
r.patch('/fines/:id/waive', chairperson, fines.waive);

r.get('/expenses', expenses.list);
r.post('/expenses', treasurer, expenses.create);
r.put('/expenses/:id', treasurer, expenses.update);
r.delete('/expenses/:id', treasurer, expenses.remove);

r.get('/meetings', meetings.list);
r.get('/meetings/:id', meetings.show);
r.post('/meetings', chairOrSecretary, meetings.create);
r.put('/meetings/:id', chairOrSecretary, meetings.update);
r.put('/meetings/:id/attendance', secretary, meetings.setAttendance);

r.get('/reports/summary', officials, reports.summary);
r.get('/reports/statement/:memberId', reports.statement); // controller allows self

module.exports = r;
