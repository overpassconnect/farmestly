function ok(payload = {}, updates = null) {
	const response = {
		HEADERS: { STATUS_CODE: 'OK', VALIDATION: null },
		PAYLOAD: payload
	};

	if (updates && Object.keys(updates).length > 0) {
		response.UPDATES = updates;
	}

	return response;
}

function fail(code, validation = null) {
	return {
		HEADERS: { STATUS_CODE: code, VALIDATION: validation },
		PAYLOAD: null
	};
}

module.exports = { ok, fail };