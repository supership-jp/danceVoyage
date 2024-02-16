"use client";

import { DocumentSet } from "@/lib/types";
import { Button, Divider, Text } from "@tremor/react";
import { ArrayHelpers, FieldArray, Form, Formik } from "formik";

import * as Yup from "yup";
import { buildFinalPrompt, createPersona, updatePersona } from "./lib";
import { useRouter } from "next/navigation";
import { usePopup } from "@/components/admin/connectors/Popup";
import { Persona } from "./interfaces";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BooleanFormField,
  SelectorFormField,
  TextFormField,
} from "@/components/admin/connectors/Field";

function SectionHeader({ children }: { children: string | JSX.Element }) {
  return <div className="mb-4 font-bold text-lg">{children}</div>;
}

function Label({ children }: { children: string | JSX.Element }) {
  return (
    <div className="block font-medium text-base text-emphasis">{children}</div>
  );
}

function SubLabel({ children }: { children: string | JSX.Element }) {
  return <div className="text-sm text-subtle mb-2">{children}</div>;
}

export function PersonaEditor({
  existingPersona,
  documentSets,
  llmOverrideOptions,
  defaultLLM,
}: {
  existingPersona?: Persona | null;
  documentSets: DocumentSet[];
  llmOverrideOptions: string[];
  defaultLLM: string;
}) {
  const router = useRouter();
  const { popup, setPopup } = usePopup();

  const [finalPrompt, setFinalPrompt] = useState<string | null>("");
  const [finalPromptError, setFinalPromptError] = useState<string>("");

  const triggerFinalPromptUpdate = async (
    systemPrompt: string,
    taskPrompt: string,
    retrievalDisabled: boolean
  ) => {
    const response = await buildFinalPrompt(
      systemPrompt,
      taskPrompt,
      retrievalDisabled
    );
    if (response.ok) {
      setFinalPrompt((await response.json()).final_prompt_template);
    }
  };

  const isUpdate = existingPersona !== undefined && existingPersona !== null;
  const existingPrompt = existingPersona?.prompts[0] ?? null;

  useEffect(() => {
    if (isUpdate && existingPrompt) {
      triggerFinalPromptUpdate(
        existingPrompt.system_prompt,
        existingPrompt.task_prompt,
        existingPersona.num_chunks === 0
      );
    }
  }, []);

  return (
    <div>
      {popup}
      <Formik
        enableReinitialize={true}
        initialValues={{
          name: existingPersona?.name ?? "",
          description: existingPersona?.description ?? "",
          system_prompt: existingPrompt?.system_prompt ?? "",
          task_prompt: existingPrompt?.task_prompt ?? "",
          disable_retrieval: (existingPersona?.num_chunks ?? 10) === 0,
          document_set_ids:
            existingPersona?.document_sets?.map(
              (documentSet) => documentSet.id
            ) ?? ([] as number[]),
          num_chunks: existingPersona?.num_chunks ?? null,
          include_citations:
            existingPersona?.prompts[0]?.include_citations ?? true,
          llm_relevance_filter: existingPersona?.llm_relevance_filter ?? false,
          llm_model_version_override:
            existingPersona?.llm_model_version_override ?? null,
        }}
        validationSchema={Yup.object()
          .shape({
            name: Yup.string().required("Must give the Persona a name!"),
            description: Yup.string().required(
              "Must give the Persona a description!"
            ),
            system_prompt: Yup.string(),
            task_prompt: Yup.string(),
            disable_retrieval: Yup.boolean().required(),
            document_set_ids: Yup.array().of(Yup.number()),
            num_chunks: Yup.number().max(20).nullable(),
            include_citations: Yup.boolean().required(),
            llm_relevance_filter: Yup.boolean().required(),
            llm_model_version_override: Yup.string().nullable(),
          })
          .test(
            "system-prompt-or-task-prompt",
            "Must provide at least one of System Prompt or Task Prompt",
            (values) => {
              const systemPromptSpecified = values.system_prompt
                ? values.system_prompt.length > 0
                : false;
              const taskPromptSpecified = values.task_prompt
                ? values.task_prompt.length > 0
                : false;
              if (systemPromptSpecified || taskPromptSpecified) {
                setFinalPromptError("");
                return true;
              } // Return true if at least one field has a value

              setFinalPromptError(
                "Must provide at least one of System Prompt or Task Prompt"
              );
            }
          )}
        onSubmit={async (values, formikHelpers) => {
          if (finalPromptError) {
            setPopup({
              type: "error",
              message: "Cannot submit while there are errors in the form!",
            });
            return;
          }

          formikHelpers.setSubmitting(true);

          // if disable_retrieval is set, set num_chunks to 0
          // to tell the backend to not fetch any documents
          const numChunks = values.disable_retrieval
            ? 0
            : values.num_chunks || 10;

          let promptResponse;
          let personaResponse;
          if (isUpdate) {
            [promptResponse, personaResponse] = await updatePersona({
              id: existingPersona.id,
              existingPromptId: existingPrompt?.id,
              ...values,
              num_chunks: numChunks,
            });
          } else {
            [promptResponse, personaResponse] = await createPersona({
              ...values,
              num_chunks: numChunks,
            });
          }

          let error = null;
          if (!promptResponse.ok) {
            error = await promptResponse.text();
          }
          if (personaResponse && !personaResponse.ok) {
            error = await personaResponse.text();
          }

          if (error) {
            setPopup({
              type: "error",
              message: `Failed to create Persona - ${error}`,
            });
            formikHelpers.setSubmitting(false);
          } else {
            router.push(`/admin/personas?u=${Date.now()}`);
          }
        }}
      >
        {({ isSubmitting, values, setFieldValue }) => (
          <Form>
            <div className="pb-6">
              <SectionHeader>Who am I?</SectionHeader>

              <TextFormField
                name="name"
                label="エージェント名"
                disabled={isUpdate}
                subtext="`[自分の名前]両津bot`のようにエージェント名を設定してください。"
              />

              <TextFormField
                name="description"
                label="説明"
                subtext="エージェントの説明文"
              />

              <Divider />

              <SectionHeader>Customize my response style</SectionHeader>

              <TextFormField
                name="system_prompt"
                label="システムプロンプト"
                isTextArea={true}
                subtext={
                  "システムプロンプトは、モデルの役割設定や対話のスタイルを設定するために使用されます。例えば、ユーザーがモデルにより友好的な応答を望む場合や、特定の知識レベルで回答を限定したい場合に、システムプロンプトを使用してこれらの条件を設定します。ex.「あなたはこち亀の両津勘吉として振る舞ってください。初心者にも分かりやすい言葉を使ってください。」"
                }
                onChange={(e) => {
                  setFieldValue("system_prompt", e.target.value);
                  triggerFinalPromptUpdate(
                    e.target.value,
                    values.task_prompt,
                    values.disable_retrieval
                  );
                }}
                error={finalPromptError}
              />

              <TextFormField
                name="task_prompt"
                label="プロンプト"
                isTextArea={true}
                subtext={
                  "モデルに実行してほしい具体的なタスクや質問を定義します。これは、情報の検索、文章の生成、質問への回答、あるいは特定のテーマに沿った内容の作成など、ユーザーが求める特定のアクションに関連しています。モデルが期待されるタスクを理解し、それに応じて最も適切な応答を提供するための指示です。ex. 「両津勘吉としてユーザーの質問に回答してください。」"
                }
                onChange={(e) => {
                  setFieldValue("task_prompt", e.target.value);
                  triggerFinalPromptUpdate(
                    values.system_prompt,
                    e.target.value,
                    values.disable_retrieval
                  );
                }}
                error={finalPromptError}
              />

              {!values.disable_retrieval && (
                <BooleanFormField
                  name="include_citations"
                  label="引用符を付ける"
                  subtext={`
                  設定されている場合、LLMが応答を通知するのに使用した各ドキュメントに対して、括弧付きの引用符([1], [2]など)が応答に含まれます。一般的に、LLMの回答への信頼を高めるために、これを有効にしておくことをお勧めします。`}
                />
              )}

              <BooleanFormField
                name="disable_retrieval"
                label="ドキュメント検索を無効にする"
                subtext={`
                設定されている場合、ドキュメントの検索(RAG)が無効になります。`}
                onChange={(e) => {
                  setFieldValue("disable_retrieval", e.target.checked);
                  triggerFinalPromptUpdate(
                    values.system_prompt,
                    values.task_prompt,
                    e.target.checked
                  );
                }}
              />

              <Label>プロンプトプレビュー</Label>

              {finalPrompt ? (
                <pre className="text-sm mt-2 whitespace-pre-wrap">
                  {finalPrompt}
                </pre>
              ) : (
                "-"
              )}

              <Divider />

              {!values.disable_retrieval && (
                <>
                  <SectionHeader>どのデータにアクセスしますか？</SectionHeader>

                  <FieldArray
                    name="document_set_ids"
                    render={(arrayHelpers: ArrayHelpers) => (
                      <div>
                        <div>
                          <SubLabel>
                            <>
                              Select which{" "}
                              <Link
                                href="/admin/documents/sets"
                                className="text-blue-500"
                                target="_blank"
                              >
                                Document Sets
                              </Link>{" "}
                              that this Persona should search through. If none
                              are specified, the Persona will search through all
                              available documents in order to try and response
                              to queries.
                            </>
                          </SubLabel>
                        </div>
                        <div className="mb-3 mt-2 flex gap-2 flex-wrap text-sm">
                          {documentSets.map((documentSet) => {
                            const ind = values.document_set_ids.indexOf(
                              documentSet.id
                            );
                            let isSelected = ind !== -1;
                            return (
                              <div
                                key={documentSet.id}
                                className={
                                  `
                              px-3 
                              py-1
                              rounded-lg 
                              border
                              border-border
                              w-fit 
                              flex 
                              cursor-pointer ` +
                                  (isSelected
                                    ? " bg-hover"
                                    : " bg-background hover:bg-hover-light")
                                }
                                onClick={() => {
                                  if (isSelected) {
                                    arrayHelpers.remove(ind);
                                  } else {
                                    arrayHelpers.push(documentSet.id);
                                  }
                                }}
                              >
                                <div className="my-auto">
                                  {documentSet.name}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  />

                  <Divider />
                </>
              )}

              {llmOverrideOptions.length > 0 && defaultLLM && (
                <>
                  <SectionHeader>[Advanced] Model Selection</SectionHeader>

                  <Text>
                    Pick which LLM to use for this Persona. If left as Default,
                    will use <b className="italic">{defaultLLM}</b>.
                    <br />
                    <br />
                    For more information on the different LLMs, checkout the{" "}
                    <a
                      href="https://platform.openai.com/docs/models"
                      target="_blank"
                      className="text-blue-500"
                    >
                      OpenAI docs
                    </a>
                    .
                  </Text>

                  <div className="w-96">
                    <SelectorFormField
                      name="llm_model_version_override"
                      options={llmOverrideOptions.map((llmOption) => {
                        return {
                          name: llmOption,
                          value: llmOption,
                        };
                      })}
                      includeDefault={true}
                    />
                  </div>
                </>
              )}

              <Divider />

              {!values.disable_retrieval && (
                <>
                  <SectionHeader>
                    [Advanced] Retrieval Customization
                  </SectionHeader>

                  <TextFormField
                    name="num_chunks"
                    label="Number of Chunks"
                    subtext={
                      <div>
                        How many chunks should we feed into the LLM when
                        generating the final response? Each chunk is ~400 words
                        long. If you are using gpt-3.5-turbo or other similar
                        models, setting this to a value greater than 5 will
                        result in errors at query time due to the model&apos;s
                        input length limit.
                        <br />
                        <br />
                        If unspecified, will use 10 chunks.
                      </div>
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow only integer values
                      if (value === "" || /^[0-9]+$/.test(value)) {
                        setFieldValue("num_chunks", value);
                      }
                    }}
                  />

                  <BooleanFormField
                    name="llm_relevance_filter"
                    label="Apply LLM Relevance Filter"
                    subtext={
                      "If enabled, the LLM will filter out chunks that are not relevant to the user query."
                    }
                  />

                  <Divider />
                </>
              )}

              <div className="flex">
                <Button
                  className="mx-auto"
                  color="green"
                  size="md"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isUpdate ? "更新!" : "作成!"}
                </Button>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
}
