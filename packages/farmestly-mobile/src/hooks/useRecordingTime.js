import { useState, useEffect } from 'react';
import JobService from '../utils/JobService';

/**
 * Hook for components that need live data for a single recording
 * This hook subscribes to JobService and returns the full recording object.
 *
 * @param {string|number} fieldId - The field ID to track
 * @returns {Object|null} The recording object with elapsedMs, status, jobType, etc.
 */
export function useRecordingTime(fieldId) {
    const [recording, setRecording] = useState(() => {
        return JobService.getActive(fieldId);
    });

    useEffect(() => {
        if (!fieldId) return;

        // Immediately update recording when fieldId changes
        setRecording(JobService.getActive(fieldId));

        const unsubscribe = JobService.on((event, data) => {
            if (event === 'tick' || event === 'change') {
                setRecording(JobService.getActive(fieldId));
            }
        });
        return unsubscribe;
    }, [fieldId]);

    return recording;
}

/**
 * Hook for components that need live time for ALL recordings
 * Use sparingly - component will re-render every second for each active recording
 *
 * @returns {Object} Map of fieldId to recording objects
 */
export function useAllRecordingTimes() {
    const [recordings, setRecordings] = useState(() =>
        JobService.getAllActive()
    );

    useEffect(() => {
        const unsubscribe = JobService.on((event) => {
            if (event === 'tick' || event === 'change') {
                setRecordings(JobService.getAllActive());
            }
        });
        return unsubscribe;
    }, []);

    return recordings;
}
