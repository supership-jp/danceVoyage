import { PersonasTable } from "./PersonaTable";
import { FiPlusSquare } from "react-icons/fi";
import Link from "next/link";
import { Divider, Text, Title } from "@tremor/react";
import { fetchSS } from "@/lib/utilsSS";
import { ErrorCallout } from "@/components/ErrorCallout";
import { Persona } from "./interfaces";
import { RobotIcon } from "@/components/icons/icons";
import { AdminPageTitle } from "@/components/admin/Title";

export default async function Page() {
  const personaResponse = await fetchSS("/persona");

  if (!personaResponse.ok) {
    return (
      <ErrorCallout
        errorTitle="Something went wrong :("
        errorMsg={`Failed to fetch personas - ${await personaResponse.text()}`}
      />
    );
  }

  const personas = (await personaResponse.json()) as Persona[];

  return (
    <div className="mx-auto container">
      <AdminPageTitle icon={<RobotIcon size={32} />} title="Personas" />

      <Text className="mb-2">
        さまざまなユースケースに対応したカスタム検索/質問応答体験を構築できます。
      </Text>
      <Text className="mt-2">以下のカスタムが可能です:</Text>
      <div className="text-sm">
        <ul className="list-disc mt-2 ml-4">
          <li>ユーザーの質問に回答するためのプロンプト</li>
          <li>回答に利用するドキュメントの設定</li>
        </ul>
      </div>

      <div>
        <Divider />

        <Title>エージェントを作成する</Title>
        <Link
          href="/admin/personas/new"
          className="flex py-2 px-4 mt-2 border border-border h-fit cursor-pointer hover:bg-hover text-sm w-36"
        >
          <div className="mx-auto flex">
            <FiPlusSquare className="my-auto mr-2" />
            新規作成
          </div>
        </Link>

        <Divider />

        <Title>作成済みのエージェント</Title>
        <PersonasTable personas={personas} />
      </div>
    </div>
  );
}
