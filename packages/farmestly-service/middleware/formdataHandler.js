const { ok, fail } = require('../../utils/response');
const formidable = require('formidable');
const MAGIC_NUMBERS = JSON.parse(JSON.stringify(require('./magicNumbers.json')));

module.exports = (req, res, next) => {
	//TODO: add middleware for formidable and create a new req.body with the fields and filepaths of the form (?)
	//TODO: check schema for form-data!!
	if (req.header('Content-Type')) { //GET requests do not have `Content-Type` header
		if (req.header('Content-Type').includes('multipart/form-data') && req.method === 'POST') {
			const form = formidable({
				multiples: true,
				// uploadDir: '/home/agent/node-server/uploads',
				keepExtensions: true,
				maxFileSize: 20 * 1024 * 1024
			});
			let newBody = {};
			form.onPart = (partStream) => {
				if (typeof newBody[partStream.name] === 'undefined') newBody[partStream.name] = [];

				//part is empty file:
				if (partStream.originalFilename === '' && partStream.mimetype === 'application/octet-stream') {
					newBody[partStream.name].push('PRECHECK__EMPTY_FILE');
				}

				//part is file:
				if (partStream.mimetype) {
					let filenameArray = partStream.originalFilename.split('.');
					let extension = filenameArray[filenameArray.length - 1];
					let buffers = [];
					let once = true;
					let magicNumberMatch = null;
					partStream.on('data', (buffer) => {
						if (once) {
							magicNumberMatch = checkMagicNumber(buffer, extension);
							once = false;
						}
						buffers.push(buffer);
					});
					partStream.on('end', () => {
						if (magicNumberMatch) {
							let data = Buffer.concat(buffers);
							let newBodyFileKeyName = partStream.name;
							//TODO: sanitize original file name						
							newBody[partStream.name].push({
								"_data": data,
								"mimetype": partStream.mimetype,
								"originalFilename": partStream.originalFilename,
								"filesizeB": data.length,
								"extension": extension
							});
						} else {
							newBody[partStream.name].push('PRECHECK__MAGIC_NUMBER_FALSE');
						}
					});
				} else {
					let buffers = [];
					partStream.on('data', (buffer) => {
						buffers.push(buffer);
					});
					partStream.on('end', () => {
						newBody[partStream.name] = Buffer.concat(buffers).toString();
					});
				}
			};
			form.parse(req, (err, fields, files) => {
				if (err) {
					console.error('err: ', err);
				}
				req.body = newBody;
				next();
			});
		} else if (req.header('Content-Type').includes('multipart/form-data') && req.method === 'GET') {
			res.status(400).send(fail('INVALID_FORMDATA'));
		} else next();
	} else next();

}

function checkMagicNumber(buffer, extension) {
	if (extension) {
		let signs = MAGIC_NUMBERS[extension].signs;
		for (let sign of signs) {
			let byteOffset = sign.split(',')[0];
			let signMagicNumber = sign.split(',')[1];
			let signMagicNumberBuffer = new Buffer.from(signMagicNumber, 'hex');
			if (!Buffer.compare(buffer.slice(byteOffset, signMagicNumber.length / 2), signMagicNumberBuffer)) return true;
		}
		return false;
	} else return false;
}