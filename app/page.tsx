import { getChatGPTUser } from './chatgpt-auth';
import Tempo from './components/tempo';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return <Tempo authenticated={!!user}/>;}
