var QueryChainable = require('../moonridge/query-chainable');

require('chai').should();

describe('query chainable', function() {
	var qch;
	beforeEach(function() {
		var query = {query: [], indexedByMethods: {}};
		qch = new QueryChainable(query, function() {
			var callQuery = function() {

			};

			query.exec = callQuery;
			callQuery();

			return query;
		}, {});
	});
	it('should not allow anything else but string for sort', function() {
		(function(){ qch.sort() }).should.throw(/requires one argument/);
		(function(){ qch.sort(5) }).should.throw(/takes a string as an argument/);
		(function(){ qch.sort({}) }).should.throw(/takes a string as an argument/);
		(function(){ qch.sort('prop')}).should.not.throw();
	});

});

