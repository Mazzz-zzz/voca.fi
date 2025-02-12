import FingerprintIcon from '@mui/icons-material/Fingerprint'
import { Button, Divider, Paper, Stack, Typography, Modal, Box } from '@mui/material'
import { PasskeyArgType } from '@safe-global/protocol-kit'
import { loadPasskeysFromLocalStorage } from '../util/passkeys'

type props = {
  handleCreatePasskey: () => void
  handleSelectPasskey: (passkey: PasskeyArgType) => void
  open: boolean
  onClose: () => void
}

function LoginWithPasskey({ handleCreatePasskey, handleSelectPasskey, open, onClose }: props) {
  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    borderRadius: 2,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="login-with-passkey-modal"
    >
      <Box sx={modalStyle}>
        <Stack padding={4}>
          <Typography textAlign={'center'} variant="h4" color={'primary'}>
            Use Safe Account via Passkeys
          </Typography>

          <Typography
            textAlign={'center'}
            marginBottom={4}
            marginTop={4}
            variant="h6"
          >
            Create a new Safe using passkeys
          </Typography>

          <Button
            onClick={() => {
              handleCreatePasskey();
              onClose();
            }}
            startIcon={<FingerprintIcon />}
            variant="outlined"
            sx={{ marginBottom: '24px' }}
          >
            Create a new passkey
          </Button>

          <Divider sx={{ marginTop: '32px' }}>
            <Typography variant="caption" color="GrayText">
              OR
            </Typography>
          </Divider>

          <Typography
            textAlign={'center'}
            marginBottom={4}
            marginTop={4}
            variant="h6"
          >
            Connect existing Safe using an existing passkey
          </Typography>

          <Button
            startIcon={<FingerprintIcon />}
            variant="contained"
            onClick={async () => {
              const passkeys = loadPasskeysFromLocalStorage();
              if (passkeys.length > 0) {
                handleSelectPasskey(passkeys[0]);
                onClose();
              }
            }}
          >
            Use an existing passkey
          </Button>
        </Stack>
      </Box>
    </Modal>
  );
}

export default LoginWithPasskey
