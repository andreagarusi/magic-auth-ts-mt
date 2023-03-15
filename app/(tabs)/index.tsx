import { StyleSheet } from "react-native";
import React, { useState, useEffect } from "react";
import EditScreenInfo from "../../components/EditScreenInfo";
import { View } from "../../components/Themed";
import { Magic } from "magic-sdk";
import { SolanaExtension } from "@magic-ext/solana";
import {
  NativeBaseProvider,
  Container,
  ScrollView,
  Button,
  Text,
  Input,
} from "native-base";

import * as web3 from "@solana/web3.js";

const rpcUrl = "https://api.devnet.solana.com";

const magic = new Magic("pk_live_2937A5103B85673F", {
  extensions: {
    solana: new SolanaExtension({
      rpcUrl,
    }),
  },
});

export default function TabOneScreen() {
  interface UserMetadata {
    email: string;
    publicAddress: string;
    issuer: string;
    data: Record<string, unknown>;
  }

  const [email, setEmail] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userMetadata, setUserMetadata] = useState<UserMetadata>({
    email: "",
    publicAddress: "",
    issuer: "",
    data: {},
  });
  const [balance, setBalance] = useState<number>(0);
  const [destinationAddress, setDestinationAddress] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<number>(0);
  const [txHash, setTxHash] = useState<string>("");
  const [sendingTransaction, setSendingTransaction] = useState<boolean>(false);
  const [disabled, setDisabled] = useState<boolean>(false);

  const connection = new web3.Connection(rpcUrl);

  useEffect(() => {
    magic.user.isLoggedIn().then(async (magicIsLoggedIn: boolean) => {
      setIsLoggedIn(magicIsLoggedIn);
      if (magicIsLoggedIn) {
        magic.user.getMetadata().then((user: any) => {
          setUserMetadata(user);
          const pubKey = new web3.PublicKey(user.publicAddress);
          getBalance(pubKey);
        });
      }
    });
  }, [isLoggedIn]);

  const login = async () => {
    await magic.auth.loginWithMagicLink({ email });
    setIsLoggedIn(true);
  };

  const logout = async () => {
    await magic.user.logout();
    setIsLoggedIn(false);
  };

  const getBalance = async (pubKey: web3.PublicKey) => {
    connection
      .getBalance(pubKey)
      .then((bal: number) => setBalance(bal / 1000000000));
  };

  const requestSol = async () => {
    setDisabled(true);
    const pubKey = new web3.PublicKey(userMetadata.publicAddress);
    const airdropSignature = await connection.requestAirdrop(
      pubKey,
      web3.LAMPORTS_PER_SOL
    );

    await connection.confirmTransaction(airdropSignature);
    getBalance(pubKey);
    setDisabled(false);
  };

  const handleSendTransaction = async () => {
    setSendingTransaction(true);
    const recipientPubKey = new web3.PublicKey(destinationAddress);
    const payer = new web3.PublicKey(userMetadata.publicAddress);

    const hash = await connection.getRecentBlockhash();

    let transactionMagic = new web3.Transaction({
      feePayer: payer,
      recentBlockhash: hash.blockhash,
    });

    const transaction = web3.SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: recipientPubKey,
      lamports: sendAmount,
    });

    transactionMagic.add(...[transaction]);

    const serializeConfig = {
      requireAllSignatures: false,
      verifySignatures: true,
    };

    const signedTransaction = await magic.solana.signTransaction(
      transactionMagic,
      serializeConfig
    );

    console.log("Signed transaction", signedTransaction);

    const tx = web3.Transaction.from(signedTransaction.rawTransaction);
    const signature = await connection.sendRawTransaction(tx.serialize());
    setTxHash(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    setSendingTransaction(false);
  };

  return (
    <>
      <NativeBaseProvider>
        <Container>
          {!isLoggedIn ? (
            <ScrollView contentContainerStyle={styles.container}>
              <Text>Please sign up or login</Text>
              <Input
                placeholder="Enter your email"
                onChangeText={(text) => setEmail(text)}
              />
              <Button onPress={login}>
                <Text>Send</Text>
              </Button>
            </ScrollView>
          ) : (
            <ScrollView>
              <View style={styles.container}>
                <Text>Current user: {userMetadata.email}</Text>
                <Button onPress={logout}>
                  <Text>Logout</Text>
                </Button>
              </View>
              <View style={styles.container}>
                <Text>Solana address</Text>
                <Text>{userMetadata.publicAddress}</Text>
              </View>
              <View style={styles.container}>
                <Text>Solana Balance</Text>
                <Text>{balance} SOL</Text>
                <Button onPress={requestSol} disabled={disabled}>
                  <Text>Get 1 Test SOL</Text>
                </Button>
                {disabled && <Text>Requesting airdrop...</Text>}
              </View>
              <View style={styles.container}>
                <Text>Send Transaction</Text>
                {txHash ? (
                  <View>
                    <Text>Send transaction success</Text>
                    <Text>{txHash}</Text>
                  </View>
                ) : sendingTransaction ? (
                  <Text>Sending transaction</Text>
                ) : (
                  <View />
                )}
                <Input
                  placeholder="Destination address"
                  onChangeText={(text) => setDestinationAddress(text)}
                />
                <Input
                  placeholder="Amount in LAMPORTS"
                  onChangeText={(num) => setSendAmount(parseFloat(num))}
                />
                <Button onPress={handleSendTransaction}>
                  <Text>Sign & Send Transaction</Text>
                </Button>
              </View>
            </ScrollView>
          )}
        </Container>
      </NativeBaseProvider>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
