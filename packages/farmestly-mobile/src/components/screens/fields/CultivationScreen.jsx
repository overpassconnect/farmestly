import React, { useState, useEffect } from 'react';
import { useApi } from '../../../hooks/useApi';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useGlobalContext } from '../../context/GlobalContextProvider';
import { useUnits } from '../../../providers/UnitsProvider';
import colors from '../../../globals/colors';
import config from '../../../globals/config';

const BASE_URL = config.BASE_URL;

const CultivationScreen = () => {
	const navigation = useNavigation();
	const route = useRoute();
	const { cultivation } = route.params;
	const { farmData } = useGlobalContext();
	const { api } = useApi();
	const { format } = useUnits();
	

	const [loading, setLoading] = useState(false);
	const [timelineJobs, setTimelineJobs] = useState([]);
	const [field, setField] = useState(null);

	// Find the field for this cultivation
	useEffect(() => {
		if (farmData?.fields && cultivation.fieldId) {
			const fieldData = farmData.fields.find(f => f._id === cultivation.fieldId);
			setField(fieldData);
		}
	}, [farmData, cultivation.fieldId]);

	// Load timeline jobs (last 5 jobs for this cultivation)
	useEffect(() => {
		if (cultivation._id) {
			loadTimelineJobs();
		}
	}, [cultivation]);

	const loadTimelineJobs = async () => {
		setLoading(true);

		const result = await api(`${BASE_URL}/job/records?cultivationId=${cultivation._id}&limit=5&page=1`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (result.ok) {
			setTimelineJobs(result.data?.jobs || []);
		}

		setLoading(false);
	};

	// Navigate to Jobs tab with cultivation filter
	const handleViewFullTimeline = () => {
		navigation.navigate('Main', {
			screen: 'Jobs',
			params: {
				preAppliedFilters: {
					cultivationId: cultivation._id,
					fieldId: cultivation.fieldId,
					dateFrom: cultivation.startTime,
					dateTo: cultivation.endTime || null
				}
			}
		});
	};

	// Format date
	const formatDate = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	};

	// Format time
	const formatDateTime = (dateString) => {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		return date.toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	// Calculate duration
	const calculateDuration = () => {
		if (!cultivation.startTime) return 'N/A';

		const startDate = new Date(cultivation.startTime);
		const endDate = cultivation.endTime ? new Date(cultivation.endTime) : new Date();

		const diffTime = Math.abs(endDate - startDate);
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 1) return '1 day';
		if (diffDays < 30) return `${diffDays} days`;
		if (diffDays < 365) {
			const months = Math.floor(diffDays / 30);
			const remainingDays = diffDays % 30;
			if (remainingDays === 0) return `${months} month${months > 1 ? 's' : ''}`;
			return `${months} month${months > 1 ? 's' : ''}, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
		}

		const years = Math.floor(diffDays / 365);
		const remainingDays = diffDays % 365;
		if (remainingDays === 0) return `${years} year${years > 1 ? 's' : ''}`;
		return `${years} year${years > 1 ? 's' : ''}, ${Math.floor(remainingDays / 30)} month${Math.floor(remainingDays / 30) > 1 ? 's' : ''}`;
	};

	// Get status color and text
	const getStatusInfo = () => {
		switch (cultivation.status) {
			case 'active':
				return { color: colors.SECONDARY, text: 'Active', icon: '🌱' };
			case 'completed':
				return { color: '#4CAF50', text: 'Completed', icon: '✅' };
			default:
				return { color: colors.PRIMARY_LIGHT, text: cultivation.status, icon: '❓' };
		}
	};

	const statusInfo = getStatusInfo();

	return (
		<View style={[styles.container, ]}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
					<Text style={styles.backButtonText}>‹ Back</Text>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Cultivation Details</Text>
				<View style={styles.placeholder} />
			</View>

			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				{/* Main Cultivation Info */}
				<View style={styles.mainCard}>
					<View style={styles.cropHeader}>
						<Text style={styles.cropName}>{cultivation.crop}</Text>
						{cultivation.variety && (
							<Text style={styles.varietyName}>({cultivation.variety})</Text>
						)}
					</View>

					<View style={styles.statusContainer}>
						<Text style={styles.statusIcon}>{statusInfo.icon}</Text>
						<Text style={[styles.statusText, { color: statusInfo.color }]}>
							{statusInfo.text}
						</Text>
					</View>
				</View>

				{/* Field Information */}
				{field && (
					<View style={styles.card}>
						<Text style={styles.cardTitle}>Field Information</Text>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Field Name:</Text>
							<Text style={styles.infoValue}>{field.name}</Text>
						</View>
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Area:</Text>
							<Text style={styles.infoValue}>{format(field.area, 'area')}</Text>
						</View>
						{field.farmingType && (
							<View style={styles.infoRow}>
								<Text style={styles.infoLabel}>Farming Type:</Text>
								<Text style={styles.infoValue}>{field.farmingType}</Text>
							</View>
						)}
					</View>
				)}

				{/* Timeline Information */}
				<TouchableOpacity style={styles.card} onPress={handleViewFullTimeline} activeOpacity={0.7}>
					<View style={styles.cardHeader}>
						<Text style={styles.cardTitle}>Timeline</Text>
						<Text style={styles.chevron}>›</Text>
					</View>

					<View style={styles.timelineContainer}>
						{/* Cultivation Start */}
						<View style={styles.timelineItem}>
							<View style={styles.timelineIcon}>
								<Text style={styles.timelineIconText}>🌱</Text>
							</View>
							<View style={styles.timelineContent}>
								<Text style={styles.timelineTitle}>Cultivation Started</Text>
								<Text style={styles.timelineDate}>{formatDateTime(cultivation.startTime)}</Text>
							</View>
						</View>

						{/* Ellipses if there are jobs */}
						{timelineJobs.length > 0 && (
							<View style={styles.ellipsesContainer}>
								<Text style={styles.ellipsesText}>⋮</Text>
								<Text style={styles.ellipsesText}>⋮</Text>
								<Text style={styles.ellipsesText}>⋮</Text>
							</View>
						)}

						{/* Timeline Jobs (last 5) */}
						{loading ? (
							<View style={styles.loadingContainer}>
								<ActivityIndicator size="small" color={colors.SECONDARY} />
								<Text style={styles.loadingText}>Loading timeline...</Text>
							</View>
						) : (
							timelineJobs.map((job, index) => (
								<View key={job._id} style={styles.timelineItem}>
									<View style={styles.timelineIcon}>
										<Text style={styles.timelineIconText}>📋</Text>
									</View>
									<View style={styles.timelineContent}>
										<Text style={styles.timelineTitle}>
											{job.jobType === 'sow' ? 'Sow' :
												job.jobType === 'harvest' ? 'Harvest' :
													job.templateId ? 'Custom Job' : job.jobType}
										</Text>
										<Text style={styles.timelineDate}>{formatDateTime(job.startTime)}</Text>
										{job.notes && (
											<Text style={styles.timelineNotes} numberOfLines={1}>
												{job.notes}
											</Text>
										)}
									</View>
								</View>
							))
						)}

						{/* Ellipses before end if cultivation is completed and has jobs */}
						{cultivation.endTime && timelineJobs.length > 0 && (
							<View style={styles.ellipsesContainer}>
								<Text style={styles.ellipsesText}>⋮</Text>
								<Text style={styles.ellipsesText}>⋮</Text>
								<Text style={styles.ellipsesText}>⋮</Text>
							</View>
						)}

						{/* Cultivation End */}
						{cultivation.endTime && (
							<View style={styles.timelineItem}>
								<View style={styles.timelineIcon}>
									<Text style={styles.timelineIconText}>🌾</Text>
								</View>
								<View style={styles.timelineContent}>
									<Text style={styles.timelineTitle}>Cultivation Ended</Text>
									<Text style={styles.timelineDate}>{formatDateTime(cultivation.endTime)}</Text>
								</View>
							</View>
						)}
					</View>

					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Duration:</Text>
						<Text style={styles.infoValue}>{calculateDuration()}</Text>
					</View>

					<View style={styles.viewAllContainer}>
						<Text style={styles.viewAllText}>Tap to view all jobs</Text>
					</View>
				</TouchableOpacity>

				{/* Additional Information */}
				<View style={styles.card}>
					<Text style={styles.cardTitle}>Additional Information</Text>
					<View style={styles.infoRow}>
						<Text style={styles.infoLabel}>Cultivation ID:</Text>
						<Text style={styles.infoValueMono}>{cultivation._id}</Text>
					</View>
					{cultivation.idempotencyKey && (
						<View style={styles.infoRow}>
							<Text style={styles.infoLabel}>Reference:</Text>
							<Text style={styles.infoValueMono}>{cultivation.idempotencyKey}</Text>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: 'white',
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: colors.SECONDARY_LIGHT,
	},
	backButton: {
		padding: 8,
	},
	backButtonText: {
		fontSize: 18,
		color: colors.SECONDARY,
		fontFamily: 'Geologica-Medium',
	},
	headerTitle: {
		fontSize: 20,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
	},
	placeholder: {
		width: 40,
	},
	content: {
		flex: 1,
		padding: 20,
	},
	mainCard: {
		backgroundColor: colors.SECONDARY_LIGHT,
		borderRadius: 12,
		padding: 20,
		marginBottom: 16,
		alignItems: 'center',
	},
	cropHeader: {
		alignItems: 'center',
		marginBottom: 12,
	},
	cropName: {
		fontSize: 28,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		textAlign: 'center',
	},
	varietyName: {
		fontSize: 18,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginTop: 4,
	},
	statusContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	statusIcon: {
		fontSize: 24,
		marginRight: 8,
	},
	statusText: {
		fontSize: 18,
		fontFamily: 'Geologica-Medium',
	},
	card: {
		backgroundColor: 'white',
		borderRadius: 12,
		padding: 16,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	cardTitle: {
		fontSize: 20,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		marginBottom: 12,
	},
	cardHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12,
	},
	chevron: {
		fontSize: 24,
		color: colors.SECONDARY,
		fontWeight: 'bold',
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 8,
		flexWrap: 'wrap',
	},
	infoLabel: {
		fontSize: 16,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		flex: 1,
	},
	infoValue: {
		fontSize: 16,
		fontFamily: 'Geologica-Medium',
		color: colors.PRIMARY,
		flex: 2,
		textAlign: 'right',
	},
	infoValueMono: {
		fontSize: 12,
		fontFamily: 'RobotoMono-Regular',
		color: colors.PRIMARY,
		flex: 2,
		textAlign: 'right',
	},
	timelineContainer: {
		marginBottom: 16,
	},
	timelineItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
	},
	timelineIcon: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.SECONDARY_LIGHT,
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 12,
	},
	timelineIconText: {
		fontSize: 20,
	},
	timelineContent: {
		flex: 1,
	},
	timelineTitle: {
		fontSize: 16,
		fontFamily: 'Geologica-Medium',
		color: colors.PRIMARY,
	},
	timelineDate: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		marginTop: 2,
	},
	timelineNotes: {
		fontSize: 12,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		marginTop: 2,
		fontStyle: 'italic',
	},
	ellipsesContainer: {
		alignItems: 'center',
		paddingVertical: 8,
		marginLeft: 20,
	},
	ellipsesText: {
		fontSize: 18,
		color: colors.PRIMARY_LIGHT,
		lineHeight: 8,
	},
	viewAllContainer: {
		alignItems: 'center',
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: colors.SECONDARY_LIGHT,
		marginTop: 12,
	},
	viewAllText: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.SECONDARY,
		fontStyle: 'italic',
	},
	loadingContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 20,
	},
	loadingText: {
		marginLeft: 8,
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
		fontFamily: 'Geologica-Regular',
	},
});

export default CultivationScreen;