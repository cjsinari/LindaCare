import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CareProfilesScreen from './CareProfilesScreen';
import CareProfileDetailScreen from './CareProfileDetailScreen';
import NewCareProfileScreen from './NewCareProfileScreen';
import CareTeamScreen from './CareTeamScreen';
import ResponseBanner, { toneFor, statusLine } from '../../components/ResponseBanner';
import { PortalChromeProvider } from '../../components/caregiver/PortalChrome';
import { CAREGIVER_PORTAL } from '../../navigation/portals';
import { profiles } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { isDemoMode } from '../../config/demo';

/*
 * The care-profile screens. The service decides every case; these tests check
 * that the screens draw what it decided, and only offer what the role should
 * see -- unless demo mode asks for every button.
 */

jest.mock('../../api/endpoints', () => ({
  profiles: {
    list: jest.fn(), create: jest.fn(), get: jest.fn(), update: jest.fn(), remove: jest.fn(),
    listAssignments: jest.fn(), assign: jest.fn(), endAssignment: jest.fn(),
  },
}));
jest.mock('../../config/demo', () => ({ isDemoMode: jest.fn(() => false) }));

const mockAuth = { role: 'family' };
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }));

const ELDER = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Sample Elder One',
  dateOfBirth: '1941-03-02',
  homeAddress: '1 Demo Lane',
  medicalNotes: 'Fake notes',
  accessVia: 'family_owner',
};
const READ_ONLY = { ...ELDER, accessVia: 'caregiver_assignment' };
const refused = (status, message, code) => new ApiError(message, { status, code });

const nav = () => ({
  navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, setParams: jest.fn(),
  addListener: jest.fn(() => () => {}),
});

const show = (ui) => render(
  <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
    <PortalChromeProvider portal={CAREGIVER_PORTAL}>{ui}</PortalChromeProvider>
  </SafeAreaProvider>
);

beforeEach(() => {
  Object.values(profiles).forEach((fn) => fn.mockReset());
  isDemoMode.mockReturnValue(false);
  mockAuth.role = 'family';
});

describe('ResponseBanner', () => {
  it('colours by kind of answer', () => {
    expect([200, 201, 401, 429, 403, 404, 500, null].map(toneFor))
      .toEqual(['success', 'success', 'warning', 'warning', 'error', 'error', 'neutral', 'neutral']);
  });

  it('prints status and code only in demo mode', async () => {
    const result = { status: 403, code: 'READ_ONLY_ACCESS', message: 'Caregivers have read-only access.' };
    expect(statusLine(result)).toBe('403 READ_ONLY_ACCESS');

    await show(<ResponseBanner result={result} />);
    expect(screen.queryByText('403 READ_ONLY_ACCESS')).toBeNull();
    expect(screen.getByText('Caregivers have read-only access.')).toBeTruthy();

    isDemoMode.mockReturnValue(true);
    await show(<ResponseBanner result={result} />);
    expect(screen.getByText('403 READ_ONLY_ACCESS')).toBeTruthy();
  });
});

describe('the list', () => {
  it('offers New profile to a family member', async () => {
    profiles.list.mockResolvedValue({ count: 1, profiles: [ELDER] });
    await show(<CareProfilesScreen navigation={nav()} route={{}} />);
    expect(await screen.findByText('Sample Elder One')).toBeTruthy();
    expect(screen.getByLabelText('New profile')).toBeTruthy();
  });

  it('gives a caregiver no New profile button and its own empty state', async () => {
    mockAuth.role = 'caregiver';
    profiles.list.mockResolvedValue({ count: 0, profiles: [] });
    await show(<CareProfilesScreen navigation={nav()} route={{}} />);
    expect(await screen.findByText('No profiles are assigned to you yet.')).toBeTruthy();
    expect(screen.queryByLabelText('New profile')).toBeNull();
    expect(screen.queryByLabelText('Profile ID')).toBeNull();
  });

  it('in demo mode shows New profile and open-by-ID to a caregiver, and the 404 verbatim', async () => {
    mockAuth.role = 'caregiver';
    isDemoMode.mockReturnValue(true);
    profiles.list.mockResolvedValue({ count: 0, profiles: [] });
    profiles.get.mockRejectedValue(refused(404, 'Care profile not found.'));
    await show(<CareProfilesScreen navigation={nav()} route={{}} />);

    expect(await screen.findByLabelText('New profile')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Profile ID'), ELDER.id);
    await fireEvent.press(screen.getByLabelText('Open'));

    expect(profiles.get).toHaveBeenCalledWith(ELDER.id);
    expect(await screen.findByText('404')).toBeTruthy();
    expect(screen.getByText('Care profile not found.')).toBeTruthy();
  });
});

describe('the detail', () => {
  it('shows the owner badge and the owner actions', async () => {
    profiles.get.mockResolvedValue({ profile: ELDER });
    await show(<CareProfileDetailScreen navigation={nav()} route={{ params: { id: ELDER.id } }} />);
    expect(await screen.findByText('Family owner')).toBeTruthy();
    expect(screen.getByLabelText('Edit')).toBeTruthy();
    expect(screen.getByLabelText('Delete')).toBeTruthy();
    expect(screen.getByLabelText('Care team')).toBeTruthy();
  });

  it('is read-only for an assigned caregiver', async () => {
    mockAuth.role = 'caregiver';
    profiles.get.mockResolvedValue({ profile: READ_ONLY });
    await show(<CareProfileDetailScreen navigation={nav()} route={{ params: { id: ELDER.id } }} />);
    expect(await screen.findByText('Assigned caregiver, read-only')).toBeTruthy();
    expect(screen.queryByLabelText('Edit')).toBeNull();
    expect(screen.queryByLabelText('Delete')).toBeNull();
  });

  it('in demo mode lets a caregiver try to edit, shows the 403 and keeps the buttons', async () => {
    mockAuth.role = 'caregiver';
    isDemoMode.mockReturnValue(true);
    profiles.get.mockResolvedValue({ profile: READ_ONLY });
    profiles.update.mockRejectedValue(refused(403,
      'Caregivers have read-only access to the profiles they are assigned to.', 'READ_ONLY_ACCESS'));
    await show(<CareProfileDetailScreen navigation={nav()} route={{ params: { id: ELDER.id } }} />);

    await fireEvent.press(await screen.findByLabelText('Edit'));
    await fireEvent.press(screen.getByLabelText('Save changes'));

    // Nothing changed, so the name is sent as it is: the service still answers.
    expect(profiles.update).toHaveBeenCalledWith(ELDER.id, { fullName: 'Sample Elder One' });
    expect(await screen.findByText('403 READ_ONLY_ACCESS')).toBeTruthy();
    expect(screen.getByLabelText('Save changes')).toBeTruthy();
  });

  it('confirms a delete in place before calling the service', async () => {
    profiles.get.mockResolvedValue({ profile: ELDER });
    profiles.remove.mockResolvedValue({ message: 'Care profile deleted.' });
    await show(<CareProfileDetailScreen navigation={nav()} route={{ params: { id: ELDER.id } }} />);

    await fireEvent.press(await screen.findByLabelText('Delete'));
    expect(profiles.remove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Confirm delete'));

    expect(profiles.remove).toHaveBeenCalledWith(ELDER.id);
    expect(await screen.findByText('This profile has been deleted, along with its care team.')).toBeTruthy();
  });

  it('sends only the fields that changed', async () => {
    profiles.get.mockResolvedValue({ profile: ELDER });
    profiles.update.mockResolvedValue({ profile: { ...ELDER, homeAddress: '2 Demo Lane' } });
    await show(<CareProfileDetailScreen navigation={nav()} route={{ params: { id: ELDER.id } }} />);

    await fireEvent.press(await screen.findByLabelText('Edit'));
    await fireEvent.changeText(screen.getByLabelText('Home address'), '2 Demo Lane');
    await fireEvent.press(screen.getByLabelText('Save changes'));

    expect(profiles.update).toHaveBeenCalledWith(ELDER.id, { homeAddress: '2 Demo Lane' });
    expect(await screen.findByText('2 Demo Lane')).toBeTruthy();
  });
});

describe('creating a profile', () => {
  it('posts the form and goes back to the list with the 201', async () => {
    const navigation = nav();
    profiles.create.mockResolvedValue({ profile: ELDER });
    await show(<NewCareProfileScreen navigation={navigation} />);

    await fireEvent.changeText(screen.getByLabelText('Full name'), 'Sample Elder One');
    await fireEvent.press(screen.getByLabelText('Create profile'));

    expect(profiles.create).toHaveBeenCalledWith({
      fullName: 'Sample Elder One', dateOfBirth: null, homeAddress: null, medicalNotes: null,
    });
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('CareProfiles', {
      notice: { status: 201, message: 'Profile created for Sample Elder One.' },
    }));
  });

  it('puts a field complaint under its field', async () => {
    profiles.create.mockRejectedValue(new ApiError('Invalid input', {
      status: 400, details: [{ field: 'dateOfBirth', message: 'Use YYYY-MM-DD' }],
    }));
    await show(<NewCareProfileScreen navigation={nav()} />);
    await fireEvent.changeText(screen.getByLabelText('Full name'), 'Sample Elder One');
    await fireEvent.press(screen.getByLabelText('Create profile'));
    expect(await screen.findByText('Use YYYY-MM-DD')).toBeTruthy();
  });
});

describe('the care team', () => {
  const ASSIGNMENT = {
    id: 'a1', status: 'active', startDate: '2026-11-01', endDate: null,
    caregiver: { id: 'c1', fullName: 'Grace Achieng', phoneNumber: '+2547•••••456' },
  };

  it('assigns by phone number and shows a refusal for an unknown caregiver', async () => {
    profiles.listAssignments.mockResolvedValue({ assignments: [ASSIGNMENT] });
    profiles.assign.mockRejectedValue(refused(404,
      'No verified caregiver account was found for that phone number.', 'CAREGIVER_NOT_FOUND'));
    await show(<CareTeamScreen navigation={nav()} route={{ params: { id: ELDER.id, name: 'Sample Elder One' } }} />);

    expect(await screen.findByText('Grace Achieng')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Caregiver's phone number"), '0700000999');
    await fireEvent.press(screen.getByLabelText('Assign'));

    expect(profiles.assign).toHaveBeenCalledWith(ELDER.id, { caregiverPhone: '0700000999' });
    expect(await screen.findByText('No verified caregiver account was found for that phone number.')).toBeTruthy();
  });

  it('ends an assignment only after confirming', async () => {
    profiles.listAssignments.mockResolvedValue({ assignments: [ASSIGNMENT] });
    profiles.endAssignment.mockResolvedValue({ message: "The caregiver's access to this profile has ended." });
    await show(<CareTeamScreen navigation={nav()} route={{ params: { id: ELDER.id } }} />);

    await fireEvent.press(await screen.findByLabelText('End'));
    expect(profiles.endAssignment).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Confirm'));
    expect(profiles.endAssignment).toHaveBeenCalledWith(ELDER.id, 'a1');
  });

  it('shows the refusal to a non-owner and keeps the assign form', async () => {
    profiles.listAssignments.mockRejectedValue(refused(403,
      'Caregivers have read-only access to the profiles they are assigned to.', 'READ_ONLY_ACCESS'));
    await show(<CareTeamScreen navigation={nav()} route={{ params: { id: ELDER.id } }} />);

    expect(await screen.findByText('Caregivers have read-only access to the profiles they are assigned to.')).toBeTruthy();
    expect(screen.getByLabelText('Assign')).toBeTruthy();
  });
});
