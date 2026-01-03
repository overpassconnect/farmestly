import React from 'react';
import {
	StyleSheet,
	View,
	Text,
	Image,
	TouchableOpacity,
} from 'react-native';
import colors from '../../../globals/colors';

const ListItem = ({
	title,
	subTitle1,
	timeCount,
	subTitle2,
	onPress,
	showChevron = true,
	unit = "Hours",
	icon,
	simple = false,
	syncStatus = null, // synced, pending, null
	showRadio = false,
	isSelected = false,
}) => {
	// console.log(title)
	return (
		<TouchableOpacity
			style={styles.container}
			onPress={onPress}
			disabled={!onPress} activeOpacity={1}
		>
			{icon && (
				<View style={styles.iconContainer}>
					{/* Check if icon is a number (image source from require()) or JSX component */}
					{typeof icon === 'number' ? (
						<Image resizeMethod='contain' style={styles.icon} source={icon}></Image>
					) : (
						icon
					)}
					{syncStatus && (
						<View style={[
							styles.syncIndicator,
							syncStatus === 'synced' ? styles.syncedIndicator : styles.pendingIndicator
						]}>
							<Text style={styles.syncIndicatorText}>
								{syncStatus === 'synced' ? '✓' : '⟳'}
							</Text>
						</View>
					)}
				</View>
			)}
			<View style={styles.detailsContainer}>
				<View style={styles.titleContainer}>
					<Text style={styles.name}>{title}</Text>
				</View>
				{(subTitle1 || subTitle2) && (
					<View style={styles.subTitleContainer}>
						<Text style={styles.make}>
							{subTitle1 ? ` ${subTitle1}` : ''}
							{subTitle2 ? ` • ${subTitle2}` : ''}
						</Text>
					</View>
				)}
			</View>

			{
				simple ? null : (
					<View style={styles.hoursContainer}>
						<Text style={styles.hoursCount}>{timeCount}</Text>
						{timeCount != null && (
							<Text style={styles.hoursText}>{` ${unit}`}</Text>
						)}
					</View>
				)
			}

			{
				showChevron && (
					<View style={styles.chevronContainer}>
						<Image resizeMode='contain' source={require('../../../assets/icons/arrow_right.png')} style={styles.chevron}></Image>
					</View>
				)
			}

			{
				showRadio && (
					<View style={styles.radioContainer}>
						<View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
							{isSelected && <View style={styles.radioInner} />}
						</View>
					</View>
				)
			}
			<View style={styles.separator}></View>
		</TouchableOpacity>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '100%',
		borderBottomColor: colors.PRIMARY_LIGHT,
		borderBottomWidth: 1,
		marginTop: 10,
		paddingBottom: 10,
		paddingRight: 8,
		paddingLeft: 8,
	},
	iconContainer: {
		marginRight: 12,
		position: 'relative',
		minWidth: 36,
		justifyContent: 'center',
		alignItems: 'center',
	},
	icon: {
		width: 36,
		height: 36
	},
	syncIndicator: {
		position: 'absolute',
		right: -4,
		bottom: -4,
		width: 16,
		height: 16,
		borderRadius: 8,
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: 'white',
	},
	syncedIndicator: {
		backgroundColor: '#4CAF50', // Green
	},
	pendingIndicator: {
		backgroundColor: '#FFC107', // Amber/yellow
	},
	syncIndicatorText: {
		color: 'white',
		fontSize: 10,
		fontWeight: 'bold',
		textAlign: 'center',
		lineHeight: 14,
	},
	detailsContainer: {
		flex: 1,
		justifyContent: 'center',
	},
	titleContainer: {
		marginBottom: -2,
	},
	name: {
		fontFamily: 'Geologica-Bold',
		fontSize: 16,
		fontWeight: '600',
		color: colors.PRIMARY,
	},
	subTitleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	make: {
		fontFamily: 'Geologica-Regular',
		fontSize: 14,
		color: colors.PRIMARY_LIGHT,
	},
	hoursContainer: {
		alignItems: 'flex-end',
	},
	hoursCount: {
		fontSize: 17,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
	},
	hoursText: {
		top: -2,
		fontSize: 12,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY,
	},
	chevronContainer: {
		marginLeft: 14
	},
	chevron: {
		width: 12,
		height: 64
	},
	radioContainer: {
		paddingLeft: 12,
	},
	radioOuter: {
		width: 24,
		height: 24,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: colors.PRIMARY_LIGHT,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'white',
	},
	radioOuterSelected: {
		borderColor: colors.SECONDARY,
		borderWidth: 2,
	},
	radioInner: {
		width: 14,
		height: 14,
		borderRadius: 7,
		backgroundColor: colors.SECONDARY,
	},
});

export default ListItem;