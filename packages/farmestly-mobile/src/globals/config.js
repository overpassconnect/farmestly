const JOB_TYPES = ['sow', 'harvest', 'spray', 'irrigate', 'custom'];

const JOB_TYPE_ICONS = {
	sow: require('../assets/icons/job_icon_builtin.png'),
	harvest: require('../assets/icons/job_icon_builtin.png'),
	spray: require('../assets/icons/job_icon_builtin_spray.png'),
	irrigate: require('../assets/icons/spray.png'),
	custom: require('../assets/icons/job_icon.png')
};

export default config = {
	"GOOGLE_MAPS_API_KEY": "AIzaSyACwf3nOjJkgzrJY7gvGchCTyzKQsJkYlo",
	"BASE_URL": "https://farmestly.dev-staging.overpassconnect.com",
	// "BASE_URL": "http://api.farmestly.development"
	// "BASE_URL": "http://api.farmestly.com"
	// "BASE_URL": "http://api.farmestly.com"
	JOB_TYPES,
	JOB_TYPE_ICONS
}