import React, { FC } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { PageToolbar, ToolbarButton, useStyles, CustomScrollbar } from '@grafana/ui';
import { css } from '@emotion/css';

import AlertTypeSection from './AlertTypeSection';
import AlertConditionsSection from './AlertConditionsSection';
import AlertDetails from './AlertDetails';
import Expression from './Expression';
import { useForm, FormContext } from 'react-hook-form';

import { fetchRulerRulesNamespace, setRulerRuleGroup } from '../../api/ruler';
import { RulerRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';
import { locationService } from '@grafana/runtime';
import { RuleFormValues } from '../../types/rule-form';

type Props = {};

const defaultValues: RuleFormValues = Object.freeze({
  name: '',
  labels: [],
  annotations: [],
  forTime: 1,
  forUnit: 'm',
});

export const AlertRuleForm: FC<Props> = () => {
  const styles = useStyles(getStyles);

  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues,
  });

  const { handleSubmit, watch } = formAPI;

  const values = watch();

  const showStep2 = values.dataSource && values.group && values.namespace && values.type;

  const onSubmit = (alertRule: RuleFormValues) => {
    const { name, expression, forTime, dataSource, forUnit, labels, annotations, namespace, group } = alertRule;
    console.log('saving', alertRule);
    if (namespace && group && expression && dataSource && name) {
      fetchRulerRulesNamespace(dataSource.name, namespace)
        .then((ruleGroup) => {
          const existingGroup: RulerRuleGroupDTO = ruleGroup.find(({ name }) => name === group) || {
            name: group,
            rules: [] as RulerRuleDTO[],
          };
          const alertRule: RulerRuleDTO = {
            alert: name,
            expr: expression,
            for: `${forTime}${forUnit}`,
            labels: labels.reduce((acc, { key, value }) => {
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string>),
            annotations: annotations.reduce((acc, { key, value }) => {
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            }, {} as Record<string, string>),
          };

          return setRulerRuleGroup(dataSource.name, namespace, {
            ...existingGroup,
            rules: existingGroup.rules.concat(alertRule),
          });
        })
        .then(() => {
          console.log('Alert rule saved successfully');
          locationService.push('/alerting/list');
        })
        .catch((error) => console.error(error));
    }
  };
  return (
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <PageToolbar title="Create alert rule" pageIcon="bell" className={styles.toolbar}>
          <ToolbarButton variant="default">Cancel</ToolbarButton>
          <ToolbarButton variant="primary" type="submit">
            Save
          </ToolbarButton>
          <ToolbarButton variant="primary">Save and exit</ToolbarButton>
        </PageToolbar>
        <div className={styles.contentOutter}>
          <CustomScrollbar autoHeightMin="100%">
            <div className={styles.contentInner}>
              <AlertTypeSection />
              {showStep2 && (
                <>
                  <Expression />
                  <AlertConditionsSection />
                  <AlertDetails />
                </>
              )}
            </div>
          </CustomScrollbar>
        </div>
      </form>
    </FormContext>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    toolbar: css`
      padding-top: ${theme.spacing.sm};
      padding-bottom: ${theme.spacing.md};
      border-bottom: solid 1px ${theme.colors.border2};
    `,
    form: css`
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    contentInner: css`
      flex: 1;
      padding: ${theme.spacing.md};
    `,
    contentOutter: css`
      background: ${theme.colors.panelBg};
      overflow: hidden;
      flex: 1;
    `,
    formInput: css`
      width: 400px;
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
};