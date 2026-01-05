const trackUpdates = (req, res, next) => {
  req.updates = {};

  req.trackUpdate = (collection, doc) => {
    if (!doc || !doc._id) {
      console.warn('[trackUpdates] Ignoring update without _id:', collection, doc);
      return;
    }

    if (!req.updates[collection]) {
      req.updates[collection] = [];
    }

    const docId = String(doc._id);
    const existing = req.updates[collection].find(d => String(d._id) === docId);

    if (existing) {
      Object.assign(existing, doc);
    } else {
      req.updates[collection].push(doc);
    }
  };

  req.hasUpdates = () => Object.keys(req.updates).length > 0;

  next();
};

module.exports = trackUpdates;