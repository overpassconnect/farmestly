import React, { createContext, useContext, useState, useCallback, useRef, memo, useEffect } from 'react';
import { api } from '../../globals/api';
import { View, StyleSheet, BackHandler, Keyboard } from 'react-native';
import { GestureHandlerRootView, gestureHandlerRootHOC } from 'react-native-gesture-handler';
import GorhomBottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Easing } from 'react-native-reanimated';

const BottomSheetContext = createContext(null);

const Backdrop = memo(({ isDismissible = true, ...props }) => (
	<BottomSheetBackdrop
		{...props}
		disappearsOnIndex={-1}
		appearsOnIndex={0}
		pressBehavior={isDismissible ? "close" : "none"}
	/>
));

// const ContentContainer = memo(({ children }) => (
// 	<BottomSheetView style={styles.contentContainer}>
// 		{children}
// 	</BottomSheetView>
// ));

// const WrappedGestureHandler = ({ children }) => (
// 	<GestureHandlerRootView style={styles.flex} simultaneous>
// 		{children}
// 	</GestureHandlerRootView>
// );

// const WrappedGestureHandler = gestureHandlerRootHOC(GestureWrapper);

const ANIMATION_DURATION = 150;

const BottomSheetProvider = ({ children }) => {
	const bottomSheetRef = useRef(null);
	const currentPosition = useRef(0);
	const [isOpen, setIsOpen] = useState(false);
	const [content, setContent] = useState(null);
	const [snapPoints, setSnapPoints] = useState(['25%', '50%', '75%']);
	const [isDismissible, setIsDismissible] = useState(true);
	const [borderColor, setBorderColor] = useState(null);
	const [enableBackdrop, setEnableBackdrop] = useState(true);
	const [enableDynamicSizing, setEnableDynamicSizing] = useState(false);
	const onDismissRef = useRef(null); // ADD THIS
	const onOpenedRef = useRef(null);  // ADD THIS
	const hasCalledOnOpened = useRef(false);  // ADD THIS - prevent multiple calls

	useEffect(() => {
		const handleBackPress = () => {
			if (isOpen) {
				if (isDismissible) {
					closeBottomSheet();
				}
				return true;
			}
			return false;
		};

		// FIX: Use the return value from addEventListener and call remove() on cleanup
		const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

		return () => {
			backHandler.remove(); // Fixed: use remove() instead of removeEventListener
		};
	}, [isOpen, isDismissible]);

	const openBottomSheet = useCallback((newContent, options = {}) => {
		// Dismiss keyboard when opening bottom sheet
		Keyboard.dismiss();

		if (options.snapPoints) {
			setSnapPoints(options.snapPoints);
		}
		onOpenedRef.current = options.onOpened || null;
		hasCalledOnOpened.current = false;
		onDismissRef.current = options.onDismiss || null;
		setIsDismissible(options.isDismissible !== false);
		setBorderColor(options.borderColor || null);
		setEnableBackdrop(options.enableBackdrop !== false);
		setEnableDynamicSizing(options.enableDynamicSizing === true);
		setContent(newContent);
		setIsOpen(true);
		currentPosition.current = 0;
	}, []);

	const closeBottomSheet = useCallback(() => {
		if (!isDismissible) return;

		bottomSheetRef.current?.forceClose({
			duration: ANIMATION_DURATION,
		});

		setTimeout(() => {
			setIsOpen(false);
			setContent(null);
			setBorderColor(null);
			setEnableBackdrop(true);
			currentPosition.current = 0;
			// CALL onDismiss callback
			if (onDismissRef.current) {
				onDismissRef.current();
				onDismissRef.current = null;
			}
			onOpenedRef.current = null;  // ADD THIS - cleanup
			hasCalledOnOpened.current = false;  // ADD THIS
		}, ANIMATION_DURATION + 50);
	}, [isDismissible]);

	const handleSheetChange = useCallback((index) => {
		currentPosition.current = index;
		// CALL onOpened when sheet first opens (index >= 0)
		if (index >= 0 && onOpenedRef.current && !hasCalledOnOpened.current) {
			hasCalledOnOpened.current = true;
			onOpenedRef.current();
		}
		if (index === -1 && isDismissible) {
			setIsOpen(false);
			setContent(null);
			setBorderColor(null);
			setEnableBackdrop(true);
			currentPosition.current = 0;
			// CALL onDismiss callback when user swipes to dismiss
			if (onDismissRef.current) {
				onDismissRef.current();
				onDismissRef.current = null;
			}
			onOpenedRef.current = null;  // ADD THIS - cleanup
			hasCalledOnOpened.current = false;  // ADD THIS
		}
	}, [isDismissible]);

	return (
		<BottomSheetContext.Provider
			value={{
				openBottomSheet,
				closeBottomSheet,
				isOpen
			}}
		>
			<GestureHandlerRootView style={styles.flex} simultaneous>

				{children}
				{isOpen && (
					<View style={styles.container}
						pointerEvents="box-none"
					>
						<GorhomBottomSheet
							ref={bottomSheetRef}
							snapPoints={snapPoints}
							index={0}
							enableDynamicSizing={enableDynamicSizing}
							enablePanDownToClose={isDismissible}
							backdropComponent={enableBackdrop ? (props) => <Backdrop {...props} isDismissible={isDismissible} /> : null}
							onChange={handleSheetChange}
							enableOverDrag={false}
							enableContentPanningGesture={false}
							animateOnMount={isDismissible}
							handleComponent={isDismissible ? undefined : () => null}
							enableDismissOnClose
							overDragResistanceFactor={0}
							keyboardBlurBehavior="none"
							android_keyboardInputMode="adjustNothing"
							animationConfigs={isDismissible ? {
								duration: ANIMATION_DURATION,
								easing: Easing.bezier(0.25, 0.1, 0.25, 1),
							} : {
								duration: 0
							}}
							style={[
								{ zIndex: 1 },
								borderColor && {
									borderTopLeftRadius: 24,
									borderTopRightRadius: 24,
									borderWidth: 3,
									borderBottomWidth: 0,
									borderColor: borderColor,
									shadowColor: '#000',
									shadowOffset: { width: 0, height: -4 },
									shadowOpacity: 0.2,
									shadowRadius: 8,
									elevation: 10,
								}
							]}
						>
							{content}
						</GorhomBottomSheet>
					</View>
				)}
			</GestureHandlerRootView>
		</BottomSheetContext.Provider>
	);
};

const MemoizedBottomSheetProvider = memo(BottomSheetProvider);

const useBottomSheet = () => {
	const context = useContext(BottomSheetContext);
	if (!context) {
		throw new Error('useBottomSheet must be used within a BottomSheetProvider');
	}
	return context;
};

const styles = StyleSheet.create({
	flex: {
		flex: 1
	},
	container: {
		...StyleSheet.absoluteFillObject,
		padding: 16,

	},
	contentContainer: {
		flex: 1,
		padding: 16,
		backgroundColor: 'white'
	}
});

export { MemoizedBottomSheetProvider as BottomSheetContextProvider, useBottomSheet };
export default BottomSheetContext;