import { Platform } from 'react-native';
import * as HealthKitModule from 'react-native-health';

const resolveHealthKit = () => HealthKitModule?.default ?? HealthKitModule;

const getPermissions = () => {
  const HealthKit = resolveHealthKit();
  const sleepPermission = HealthKit?.Constants?.Permissions?.SleepAnalysis || 'SleepAnalysis';
  return {
    permissions: {
      read: [sleepPermission],
      write: [],
    },
  };
};

export const isHealthKitAvailable = () => Platform.OS === 'ios';

export const initHealthKit = () => new Promise((resolve, reject) => {
  if (!isHealthKitAvailable()) {
    reject(new Error('HealthKit is only available on iOS.'));
    return;
  }
  const HealthKit = resolveHealthKit();
  if (!HealthKit?.initHealthKit) {
    reject(new Error('HealthKit module not available. Rebuild the iOS app.'));
    return;
  }
  HealthKit.initHealthKit(getPermissions(), (error) => {
    if (error) {
      reject(new Error(error.message || 'HealthKit permission denied.'));
      return;
    }
    resolve(true);
  });
});

export const getSleepSamples = ({ startDate, endDate }) => new Promise((resolve, reject) => {
  if (!isHealthKitAvailable()) {
    reject(new Error('HealthKit is only available on iOS.'));
    return;
  }
  const HealthKit = resolveHealthKit();
  if (!HealthKit?.getSleepSamples) {
    reject(new Error('HealthKit module not available. Rebuild the iOS app.'));
    return;
  }
  const options = {
    startDate,
    endDate,
    ascending: false,
  };
  HealthKit.getSleepSamples(options, (error, results) => {
    if (error) {
      reject(new Error(error.message || 'Failed to read sleep samples.'));
      return;
    }
    resolve(results || []);
  });
});
