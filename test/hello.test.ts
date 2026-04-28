import { strict as assert } from 'assert';

describe('Hello World Test', () => {
    it('should return hello world', () => {
        const hello = () => 'hello world';
        assert.equal(hello(), 'hello world');
    });
});
