import { adminRoute } from '../../../utils/social/adminApi'
import { getInstagramAccount, refreshInstagramToken } from '../../../utils/social/instagram'

// Admin: the connected Instagram account and its token's expiry ("test connection"), and renewing the token
export default adminRoute({
  GET: async () => ({ account: await getInstagramAccount() }),
  POST: async () => {
    await refreshInstagramToken()
    return { account: await getInstagramAccount() }
  },
})
