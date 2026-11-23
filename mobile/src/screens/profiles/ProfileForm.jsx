import TextField from '../../components/TextField';

/*
 * The four fields of a care profile, shared by Create and Edit.
 *
 * Validation is the service's (profileController createSchema/updateSchema):
 * its field-level answers arrive in `errors`, keyed by field, and sit under
 * the field they are about. The hints say the format up front so most people
 * never see one.
 */
export default function ProfileForm({ form, onChange, errors = {} }) {
  const set = (key) => (value) => onChange({ ...form, [key]: value });

  return (
    <>
      <TextField
        label="Full name"
        value={form.fullName}
        onChangeText={set('fullName')}
        error={errors.fullName}
        autoCapitalize="words"
        maxLength={100}
      />
      <TextField
        label="Date of birth"
        optional
        value={form.dateOfBirth}
        onChangeText={set('dateOfBirth')}
        error={errors.dateOfBirth}
        hint="YYYY-MM-DD"
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={10}
      />
      <TextField
        label="Home address"
        optional
        value={form.homeAddress}
        onChangeText={set('homeAddress')}
        error={errors.homeAddress}
        multiline
        maxLength={500}
      />
      <TextField
        label="Medical notes"
        optional
        value={form.medicalNotes}
        onChangeText={set('medicalNotes')}
        error={errors.medicalNotes}
        multiline
        maxLength={5000}
      />
    </>
  );
}
