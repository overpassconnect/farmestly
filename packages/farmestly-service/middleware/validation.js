const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');

function validate(rules) {
    return [
        ...rules,
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json(fail('INVALID', errors.array()));
            }
            next();
        }
    ];
}

module.exports = { validate };