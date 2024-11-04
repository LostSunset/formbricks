"use client";

import { createContactsFromCSVAction } from "@/modules/ee/contacts/actions";
import { CsvTable } from "@/modules/ee/contacts/components/csv-table";
import { UploadContactsAttributes } from "@/modules/ee/contacts/components/upload-contacts-attribute";
import { TContactCSVUploadResponse, ZContactCSVUploadResponse } from "@/modules/ee/contacts/types/contact";
import { parse } from "csv-parse/sync";
import { ArrowUpFromLineIcon, CircleAlertIcon, FileUpIcon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { Button } from "@formbricks/ui/components/Button";
import { Modal } from "@formbricks/ui/components/Modal";
import { StylingTabs } from "@formbricks/ui/components/StylingTabs";

interface UploadContactsCSVButtonProps {
  environmentId: string;
  contactAttributeKeys: TContactAttributeKey[];
}

export const UploadContactsCSVButton = ({
  environmentId,
  contactAttributeKeys,
}: UploadContactsCSVButtonProps) => {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [duplicateContactsAction, setDuplicateContactsAction] = useState<"skip" | "update" | "overwrite">(
    "skip"
  );
  const [csvResponse, setCSVResponse] = useState<TContactCSVUploadResponse>([]);
  const [attributeMap, setAttributeMap] = useState<Record<string, string>>({});
  const [error, setErrror] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    let selectedFiles = Array.from(e.target?.files || []);
    let csvFile = selectedFiles[0] as File;

    if (!csvFile) {
      return;
    }

    // Max file size check (800KB)
    const maxSizeInBytes = 800 * 1024; // 800KB
    if (csvFile.size > maxSizeInBytes) {
      setErrror("File size exceeds the maximum limit of 800KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      setErrror("");
      const csv = e.target?.result as string;

      try {
        const records = parse(csv, {
          columns: true, // Parse the header as column names
          skip_empty_lines: true, // Skip empty lines
        });

        const parsedRecords = ZContactCSVUploadResponse.safeParse(records);
        if (!parsedRecords.success) {
          console.error("Error parsing CSV:", parsedRecords.error);
          setErrror(parsedRecords.error.errors[0].message);
          return;
        }

        // Do something with the parsed records
        setCSVResponse(parsedRecords.data);
      } catch (error) {
        console.error("Error parsing CSV:", error);
      }
    };

    reader.readAsText(csvFile); // Trigger file read
  };

  const csvColumns = useMemo(() => {
    if (!csvResponse.length) {
      return [];
    }

    // Extract column names (headers) from the first row
    const headers = Object.keys(csvResponse[0]);
    const uniqueHeadersSet = new Set(headers.map((header) => header.trim()));
    const uniqueHeadersArray = Array.from(uniqueHeadersSet);

    return uniqueHeadersArray;
  }, [csvResponse]);

  const resetState = (closeModal?: boolean) => {
    setCSVResponse([]);
    setDuplicateContactsAction("skip");
    setErrror("");
    setAttributeMap({});
    if (closeModal) {
      setOpen(false);
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    setErrror("");

    // check for duplicate values in the attribute map
    const values = Object.values(attributeMap);
    if (new Set(values).size !== values.length) {
      setErrror("Attribute map contains duplicate values");
      setLoading(false);
      return;
    }

    const transformedCsvData = csvResponse.map((record) => {
      const newRecord: Record<string, string> = {};
      Object.entries(record).forEach(([key, value]) => {
        // if the key is in the attribute map, we wanna replace it
        if (attributeMap[key]) {
          const attrKeyId = attributeMap[key];
          const attrKey = contactAttributeKeys.find((attrKey) => attrKey.id === attrKeyId);

          if (attrKey) {
            newRecord[attrKey.key] = value;
          } else {
            newRecord[attrKeyId] = value;
          }
        } else {
          newRecord[key] = value;
        }
      });

      return newRecord;
    });

    const result = await createContactsFromCSVAction({
      csvData: transformedCsvData,
      duplicateContactsAction,
      attributeMap,
      environmentId,
    });

    if (result?.data) {
      setErrror("");
      resetState(true);

      router.refresh();
      return;
    }

    if (result?.serverError) {
      setErrror(result.serverError);
    }

    if (result?.validationErrors) {
      setErrror(result.validationErrors._errors?.[0] ?? "");
    }

    setLoading(false);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} EndIcon={PlusIcon}>
        Upload CSV
      </Button>
      <Modal
        open={open}
        setOpen={setOpen}
        noPadding
        closeOnOutsideClick={false}
        className="overflow-auto"
        size="xxl"
        hideCloseButton>
        <div className="sticky top-0 flex h-full flex-col rounded-lg">
          <button
            className={cn(
              "absolute right-0 top-0 hidden pr-4 pt-4 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-0 sm:block"
            )}
            onClick={() => {
              resetState(true);
            }}>
            <XIcon className="h-6 w-6 rounded-md bg-white" />
            <span className="sr-only">Close</span>
          </button>
          <div className="rounded-t-lg bg-slate-100">
            <div className="flex w-full items-center justify-between p-6">
              <div className="flex items-center space-x-2">
                <div className="mr-1.5 h-6 w-6 text-slate-500">
                  <FileUpIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xl font-medium text-slate-700">Upload CSV</div>
                  <div className="text-sm text-slate-500">
                    Upload a CSV to quickly import contacts with attributes
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mx-4 my-4 flex items-center gap-2 rounded-md border-2 border-red-200 bg-red-50 p-4">
            <CircleAlertIcon className="text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-8 px-6 py-4">
          <div className="no-scrollbar max-h-[400px] overflow-auto rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4">
            {!csvResponse.length ? (
              <label
                htmlFor="file"
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                )}
                // onDragOver={(e) => handleDragOver(e)}
                // onDrop={(e) => handleDrop(e)}>
              >
                <div className="flex flex-col items-center justify-center pb-6 pt-5">
                  <ArrowUpFromLineIcon className="h-6 text-slate-500" />
                  <p className={cn("mt-2 text-center text-sm text-slate-500")}>
                    <span className="font-semibold">Click or drag to upload files.</span>
                  </p>
                  <input
                    type="file"
                    id={"file"}
                    name={"file"}
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </label>
            ) : (
              <div className="flex flex-col items-center gap-8">
                <h3 className="text-lg font-medium text-slate-500">Here&apos;s a preview of your data.</h3>
                <div className="h-[300px] w-full overflow-auto rounded-md border border-slate-300">
                  <CsvTable data={[...csvResponse.slice(0, 11)]} />
                </div>
              </div>
            )}
          </div>

          {csvResponse.length > 0 ? (
            <div className="flex flex-col">
              <h3 className="font-medium text-slate-900">Attributes</h3>
              <p className="mb-2 text-slate-500">Attribute mappings</p>

              <div className="flex flex-col gap-2">
                {csvColumns.map((column) => {
                  return (
                    <UploadContactsAttributes
                      csvColumn={column}
                      attributeMap={attributeMap}
                      setAttributeMap={setAttributeMap}
                      contactAttributeKeys={contactAttributeKeys}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col">
            <h3 className="font-medium text-slate-900">Duplicates</h3>
            <p className="mb-2 text-slate-500">
              How should we handle if a contact already exists in your contacts?
            </p>
            <StylingTabs
              id="duplicate-contacts"
              options={[
                { value: "skip", label: "Skip" },
                { value: "update", label: "Update" },
                { value: "overwrite", label: "Overwrite" },
              ]}
              defaultSelected={duplicateContactsAction}
              onChange={(value) => setDuplicateContactsAction(value)}
              className="max-w-[400px]"
              tabsContainerClassName="p-1 rounded-lg"
            />

            <div className="mt-1">
              <p className="text-sm font-medium text-slate-500">
                {duplicateContactsAction === "skip" && "Skips the duplicate contacts"}
                {duplicateContactsAction === "update" && "Updates the duplicate contacts"}
                {duplicateContactsAction === "overwrite" && "Overwrites the duplicate contacts"}
              </p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 w-full bg-white">
          <div className="flex justify-end rounded-b-lg p-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                resetState();
              }}
              className="mr-2">
              Pick a different file
            </Button>
            <Button size="sm" variant="primary" onClick={handleUpload} loading={loading} disabled={loading}>
              Upload contacts
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};