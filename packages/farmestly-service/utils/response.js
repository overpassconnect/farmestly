function ok(payload = {}) {
	return {
		HEADERS: { STATUS_CODE: 'OK', VALIDATION: null },
		PAYLOAD: payload
	};
}

function fail(code, validation = null) {
	return {
		HEADERS: { STATUS_CODE: code, VALIDATION: validation },
		PAYLOAD: null
	};
}

module.exports = { ok, fail };