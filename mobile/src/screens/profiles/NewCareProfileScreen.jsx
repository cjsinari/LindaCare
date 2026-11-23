import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PortalShell from '../../components/caregiver/PortalShell';
import Card from '../../components/oneui/Card';
import PillButton from '../../components/oneui/PillButton';
import ResponseBanner, { failed, ok } from '../../components/ResponseBanner';
import { profiles as profilesApi } from '../../api/endpoints';
import { colors, space, type } from '../../theme/tokens';
import ProfileForm from './ProfileForm';
import { bodyFrom, emptyForm, fieldErrors } from './shared';

/*
 * Register someone in your care: POST /profiles.
 *
 * Only family accounts may create a profile, and that is the service's rule:
 * this screen is reached from a button the list draws for family members (and,
 * in demo mode, for everyone, so a caregiver's attempt can be refused live).
 *
 * On success the person goes back to the list, which reloads and shows the
 * service's answer -- the new profile is in the list because the service
 * listed it, not because this screen added it.
 */
export default function NewCareProfileScreen({ navigation }) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('CareProfiles'));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      const { profile } = await profilesApi.create(bodyFrom(form));
      navigation.navigate('CareProfiles', {
        notice: ok(201, `Profile created for ${profile.fullName}.`),
      });
    } catch (err) {
      setErrors(fieldErrors(err));
      setResult(failed(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalShell
      navigation={navigation}
      active="CareProfiles"
      barTitle="New profile"
      title="New profile"
      subtitle="Someone in your care"
      onBack={back}
    >
      <View style={styles.sections}>
        <ResponseBanner result={result} />
        <Card style={styles.card}>
          <Text style={styles.note}>
            Only the name is required. You can add the rest later, and you decide who on the care
            team can read it.
          </Text>
          <ProfileForm form={form} onChange={setForm} errors={errors} />
          <PillButton label="Create profile" icon="checkmark" full onPress={submit} loading={busy} />
        </Card>
      </View>
    </PortalShell>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xl },
  card: { gap: space.md },
  note: { ...type.caption, color: colors.inkMuted },
});
