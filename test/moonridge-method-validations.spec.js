require('chai').should();

var validations = require('../lib/moonridge-method-validations');

describe('moonridge method validations', function() {
	it('should fail when validating distinct call with wrong number or arguments', function() {
		validations.distinct([]).should.be.an.Error;
		validations.distinct(['', '', function() {}]).should.be.an.Error;
	});

	it('should fail when validating where call with wrong number or arguments', function() {
		validations.where([]).should.be.an.Error;
		validations.where(['', '', function() {}]).should.be.an.Error;
	});

	it('should fail when limit call has anything else but one integer', function(){
		validations.where([]).should.be.an.Error;
		validations.where('10').should.be.an.Error;
	});
});
